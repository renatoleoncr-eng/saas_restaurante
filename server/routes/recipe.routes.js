const express = require('express');
const router = express.Router();
const { Ingredient, Recipe, Product, sequelize } = require('../models');

// === INGREDIENTS ===

// Get all ingredients
router.get('/ingredients', async (req, res) => {
    try {
        const ingredients = await Ingredient.findAll();
        res.json(ingredients);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create/Update Ingredient
router.post('/ingredients', async (req, res) => {
    const { Op } = require('sequelize');
    try {
        const { name, unit, stock, id } = req.body;
        const trimmedName = name ? name.trim().toLowerCase() : '';

        // Check for duplicates (Case-insensitive, within Ingredients only)
        if (name) {
            const existingIngredient = await Ingredient.findOne({
                where: id ? {
                    [Op.and]: [
                        sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), trimmedName),
                        { id: { [Op.ne]: id } }
                    ]
                } : sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), trimmedName)
            });

            if (existingIngredient) {
                return res.status(400).json({ error: `Ya existe un insumo con el nombre "${name}".` });
            }
        }

        if (id) {
            await Ingredient.update({ name, unit, stock }, { where: { id } });
            res.json({ success: true });
        } else {
            const newItem = await Ingredient.create({ name, unit, stock });
            res.json(newItem);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Ingredient
router.delete('/ingredients/:id', async (req, res) => {
    try {
        await Ingredient.destroy({ where: { id: req.params.id } });
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
        const { type, amount, reason, userId } = req.body; // type: 'add' or 'remove'

        const ingredient = await Ingredient.findByPk(id, { transaction: t });
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
            UserId: userId || null // Should come from auth if available
        }, { transaction: t });

        await t.commit();
        res.json({ success: true, newStock });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
});

// Get Movements for an Ingredient
router.get('/ingredients/:id/movements', async (req, res) => {
    try {
        const { IngredientMovement, User } = require('../models');
        const movements = await IngredientMovement.findAll({
            where: { IngredientId: req.params.id },
            include: [{ model: User, attributes: ['username', 'displayName'] }],
            order: [['createdAt', 'DESC']],
            limit: 50
        });
        res.json(movements);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get All Movements (Global History)
router.get('/ingredients/movements/all', async (req, res) => {
    try {
        const { IngredientMovement, Ingredient, User } = require('../models');
        const movements = await IngredientMovement.findAll({
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

// Get Recipe for a Product
router.get('/recipes/:productId', async (req, res) => {
    try {
        const recipes = await Recipe.findAll({
            where: { ProductId: req.params.productId },
            include: [Ingredient]
        });
        res.json(recipes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Ingredient to Recipe
router.post('/recipes', async (req, res) => {
    try {
        const { productId, ingredientId, quantity, presentation } = req.body;

        const whereClause = {
            ProductId: productId,
            IngredientId: ingredientId,
            presentation: presentation || null
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
                presentation: presentation || null
            });
            res.json(newRecipe);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Remove Ingredient from Recipe
router.delete('/recipes/:id', async (req, res) => {
    try {
        await Recipe.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
