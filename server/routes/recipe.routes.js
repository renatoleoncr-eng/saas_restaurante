const express = require('express');
const router = express.Router();
const { Ingredient, Recipe, Product, sequelize } = require('../models');

// === INGREDIENTS ===

// Get all ingredients — scoped to tenant
router.get('/ingredients', async (req, res) => {
    try {
        const ingredients = await Ingredient.findAll({ where: { TenantId: req.tenant.id } });
        res.json(ingredients);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create/Update Ingredient — scoped to tenant
router.post('/ingredients', async (req, res) => {
    const { Op } = require('sequelize');
    try {
        const { name, unit, stock, id } = req.body;
        const trimmedName = name ? name.trim().toLowerCase() : '';
        const tenantId = req.tenant.id;

        // Check for duplicates within this tenant
        if (name) {
            const existingIngredient = await Ingredient.findOne({
                where: id ? {
                    TenantId: tenantId,
                    [Op.and]: [
                        sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), trimmedName),
                        { id: { [Op.ne]: id } }
                    ]
                } : {
                    TenantId: tenantId,
                    [Op.and]: [sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), trimmedName)]
                }
            });

            if (existingIngredient) {
                return res.status(400).json({ error: `Ya existe un insumo con el nombre "${name}".` });
            }
        }

        if (id) {
            await Ingredient.update({ name, unit, stock }, { where: { id, TenantId: tenantId } });
            res.json({ success: true });
        } else {
            const newItem = await Ingredient.create({ name, unit, stock, TenantId: tenantId });
            res.json(newItem);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Ingredient — scoped to tenant
router.delete('/ingredients/:id', async (req, res) => {
    try {
        await Ingredient.destroy({ where: { id: req.params.id, TenantId: req.tenant.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === INGREDIENT MOVEMENTS ===

// Add/Remove Stock (Manual Movement)
router.post('/ingredients/:id/movement', async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { type, amount, reason, userId } = req.body;
        const tenantId = req.tenant.id;

        const ingredient = await Ingredient.findOne({ where: { id, TenantId: tenantId }, transaction: t });
        if (!ingredient) {
            await t.rollback();
            return res.status(404).json({ error: 'Ingrediente no encontrado' });
        }

        const previousStock = parseFloat(ingredient.stock);
        let newStock = previousStock;
        const moveAmount = parseFloat(amount);

        if (type === 'add') {
            newStock += moveAmount;
        } else if (type === 'remove') {
            newStock = Math.max(0, previousStock - moveAmount);
        } else if (type === 'correction') {
            newStock = Math.max(0, moveAmount);
        }

        ingredient.stock = newStock;
        await ingredient.save({ transaction: t });

        // Create Movement Log
        const { IngredientMovement } = require('../models');
        await IngredientMovement.create({
            IngredientId: id,
            type: type,
            amount: moveAmount,
            reason: reason,
            previousStock: previousStock,
            newStock: newStock,
            UserId: userId || null,
            TenantId: tenantId
        }, { transaction: t });

        await t.commit();
        res.json({ success: true, newStock });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
});

// Get Movements for an Ingredient — scoped to tenant
router.get('/ingredients/:id/movements', async (req, res) => {
    try {
        const { IngredientMovement, User } = require('../models');
        const movements = await IngredientMovement.findAll({
            where: { IngredientId: req.params.id, TenantId: req.tenant.id },
            include: [{ model: User, attributes: ['username', 'displayName'] }],
            order: [['createdAt', 'DESC']],
            limit: 50
        });
        res.json(movements);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get All Movements (Global History) — scoped to tenant
router.get('/ingredients/movements/all', async (req, res) => {
    try {
        const { IngredientMovement, Ingredient, User } = require('../models');
        const movements = await IngredientMovement.findAll({
            where: { TenantId: req.tenant.id },
            include: [
                { model: Ingredient, attributes: ['name', 'unit'] },
                { model: User, attributes: ['username', 'displayName'] },
                { model: require('../models').Account, attributes: ['id', 'accountType'], required: false }
            ],
            order: [['createdAt', 'DESC']],
            limit: 100
        });
        res.json(movements);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === RECIPES ===

// Get Recipe for a Product — scoped to tenant
router.get('/recipes/:productId', async (req, res) => {
    try {
        const recipes = await Recipe.findAll({
            where: { ProductId: req.params.productId, TenantId: req.tenant.id },
            include: [Ingredient]
        });
        res.json(recipes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Ingredient to Recipe — scoped to tenant
router.post('/recipes', async (req, res) => {
    try {
        const { productId, ingredientId, quantity, presentation } = req.body;
        const tenantId = req.tenant.id;

        // Verify product and ingredient belong to tenant
        const product = await Product.findOne({ where: { id: productId, TenantId: tenantId } });
        if (!product) return res.status(404).json({ error: 'Producto no encontrado o no pertenece a este tenant.' });

        const ingredient = await Ingredient.findOne({ where: { id: ingredientId, TenantId: tenantId } });
        if (!ingredient) return res.status(404).json({ error: 'Ingrediente no encontrado o no pertenece a este tenant.' });

        const whereClause = {
            ProductId: productId,
            IngredientId: ingredientId,
            presentation: presentation || null,
            TenantId: tenantId
        };

        // Check if exists
        const existing = await Recipe.findOne({ where: whereClause });

        if (existing) {
            existing.quantity = quantity;
            await existing.save();
            res.json(existing);
        } else {
            const newRecipe = await Recipe.create({
                ProductId: productId,
                IngredientId: ingredientId,
                quantity,
                presentation: presentation || null,
                TenantId: tenantId
            });
            res.json(newRecipe);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Remove Ingredient from Recipe — scoped to tenant
router.delete('/recipes/:id', async (req, res) => {
    try {
        await Recipe.destroy({ where: { id: req.params.id, TenantId: req.tenant.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
