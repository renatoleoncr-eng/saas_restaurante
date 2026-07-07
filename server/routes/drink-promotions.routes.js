const express = require('express');
const router = express.Router();
const { logAction } = require('../utils/audit');

const getModels = () => require('../models');

// GET all drink promotions with their items
router.get('/drink-promotions', async (req, res) => {
    try {
        const { DrinkPromotion, DrinkPromotionItem } = getModels();
        const promos = await DrinkPromotion.findAll({
            where: { TenantId: req.tenant.id },
            include: [{
                model: DrinkPromotionItem
            }],
            order: [
                ['name', 'ASC']
            ]
        });
        res.json(promos);
    } catch (err) {
        console.error("[DrinkPromotions] GET Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST create a new promotion
router.post('/drink-promotions', async (req, res) => {
    try {
        const { DrinkPromotion } = getModels();
        const { name, price, active = true } = req.body;
        console.log("[DrinkPromotions] Creating promo:", { name, price, active });

        if (!name || price === undefined) return res.status(400).json({ error: 'Nombre y precio son requeridos' });

        // Simplified uniqueness check scoped to tenant
        const existing = await DrinkPromotion.findOne({
            where: { name: name.trim(), TenantId: req.tenant.id }
        });

        if (existing) return res.status(400).json({ error: `Ya existe una promoción con el nombre "${name}".` });

        const promo = await DrinkPromotion.create({ name, price, active, TenantId: req.tenant.id });
        console.log("[DrinkPromotions] Promo created:", promo.id);
        await logAction(req, 'CREATE_PROMO_CATEGORY', 'DrinkPromotion', promo.id, { name, price, userId: req.body.userId || null });
        res.status(201).json(promo);
    } catch (err) {
        console.error("[DrinkPromotions] POST Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// PUT update a promotion
router.put('/drink-promotions/:id', async (req, res) => {
    try {
        const { DrinkPromotion } = getModels();
        const promo = await DrinkPromotion.findOne({ where: { id: req.params.id, TenantId: req.tenant.id } });
        if (!promo) return res.status(404).json({ error: 'Promoción no encontrada' });
        const { name, price, active } = req.body;
        if (name !== undefined) {
            if (name.trim().toLowerCase() !== promo.name.trim().toLowerCase()) {
                const existing = await DrinkPromotion.findOne({
                    where: {
                        name: name.trim(),
                        TenantId: req.tenant.id,
                        id: { [require('sequelize').Op.ne]: req.params.id }
                    }
                });
                if (existing) return res.status(400).json({ error: `Ya existe otra promoción con el nombre "${name}".` });
            }
            promo.name = name;
        }
        if (price !== undefined) promo.price = price;
        if (active !== undefined) promo.active = active;
        await promo.save();
        res.json(promo);
    } catch (err) {
        console.error("[DrinkPromotions] PUT Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE a promotion (block if contains items)
router.delete('/drink-promotions/:id', async (req, res) => {
    try {
        const { DrinkPromotion, DrinkPromotionItem } = getModels();
        const promo = await DrinkPromotion.findOne({
            where: { id: req.params.id, TenantId: req.tenant.id },
            include: [{ model: DrinkPromotionItem }]
        });
        if (!promo) return res.status(404).json({ error: 'Promoción no encontrada' });

        if (promo.DrinkPromotionItems && promo.DrinkPromotionItems.length > 0) {
            return res.status(400).json({ error: 'No se puede eliminar la categoría porque contiene tragos asociados. Elimine los tragos primero.' });
        }

        await promo.destroy();
        await logAction(req, 'DELETE_PROMO_CATEGORY', 'DrinkPromotion', req.params.id, { name: promo.name, userId: req.body.userId || req.query.userId || null });
        res.json({ success: true });
    } catch (err) {
        console.error("[DrinkPromotions] DELETE Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST add item to a promotion
router.post('/drink-promotions/:id/items', async (req, res) => {
    try {
        const { DrinkPromotion, DrinkPromotionItem } = getModels();
        const promo = await DrinkPromotion.findOne({ where: { id: req.params.id, TenantId: req.tenant.id } });
        if (!promo) return res.status(404).json({ error: 'Promoción no encontrada' });
        const { name, individualPrice = 0, type = 'free', linkedProductId = null, stock = 0 } = req.body;
        if (!name) return res.status(400).json({ error: 'Nombre del trago requerido' });

        // Simplified uniqueness check
        const existingItem = await DrinkPromotionItem.findOne({
            where: {
                name: name.trim(),
                DrinkPromotionId: promo.id
            }
        });

        if (existingItem) return res.status(400).json({ error: `Este trago ya existe en esta promoción.` });

        const item = await DrinkPromotionItem.create({
            name,
            individualPrice,
            type,
            linkedProductId: type === 'finished' ? null : linkedProductId,
            stock: type === 'finished' ? (parseInt(stock) || 0) : null,
            DrinkPromotionId: promo.id,
            TenantId: req.tenant.id
        });
        await logAction(req, 'CREATE_PROMO_ITEM', 'DrinkPromotionItem', item.id, { name, promoName: promo.name, DrinkPromotionId: promo.id, userId: req.body.userId || null });
        res.status(201).json(item);
    } catch (err) {
        console.error("[DrinkPromotions] Item POST Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// PUT update a promotion item
router.put('/drink-promotions/items/:itemId', async (req, res) => {
    try {
        const { DrinkPromotionItem } = getModels();
        const item = await DrinkPromotionItem.findOne({ where: { id: req.params.itemId, TenantId: req.tenant.id } });
        if (!item) return res.status(404).json({ error: 'Item no encontrado' });
        const { name, individualPrice, type, linkedProductId, stock } = req.body;
        if (name !== undefined) {
            if (name.trim().toLowerCase() !== item.name.trim().toLowerCase()) {
                const existing = await DrinkPromotionItem.findOne({
                    where: {
                        name: name.trim(),
                        DrinkPromotionId: item.DrinkPromotionId,
                        id: { [require('sequelize').Op.ne]: req.params.itemId }
                    }
                });
                if (existing) return res.status(400).json({ error: `Ya existe otro trago con este nombre en la promoción.` });
            }
            item.name = name;
        }
        if (individualPrice !== undefined) item.individualPrice = individualPrice;
        if (type !== undefined) {
            item.type = type;
            // Clear stock if switching away from 'finished', clear linkedProductId if switching to 'finished'
            if (type === 'finished') {
                item.linkedProductId = null;
                item.stock = stock !== undefined ? (parseInt(stock) || 0) : (item.stock || 0);
            } else {
                item.stock = null;
            }
        } else if (stock !== undefined && item.type === 'finished') {
            item.stock = parseInt(stock) || 0;
        }
        if (linkedProductId !== undefined && item.type !== 'finished') item.linkedProductId = linkedProductId;
        await item.save();
        res.json(item);
    } catch (err) {
        console.error("[DrinkPromotions] Item PUT Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE a promotion item
router.delete('/drink-promotions/items/:itemId', async (req, res) => {
    try {
        const { DrinkPromotionItem } = getModels();
        const item = await DrinkPromotionItem.findOne({ where: { id: req.params.itemId, TenantId: req.tenant.id } });
        if (!item) return res.status(404).json({ error: 'Item no encontrado' });
        await item.destroy();
        await logAction(req, 'DELETE_PROMO_ITEM', 'DrinkPromotionItem', req.params.itemId, { name: item.name, DrinkPromotionId: item.DrinkPromotionId, userId: req.body.userId || req.query.userId || null });
        res.json({ success: true });
    } catch (err) {
        console.error("[DrinkPromotions] Item DELETE Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ── RECIPES FOR DRINK PROMOTION ITEMS ──────────────────────────────────────

// GET recipes for a DrinkPromotionItem
router.get('/drink-promotions/items/:itemId/recipes', async (req, res) => {
    try {
        const { DrinkItemRecipe, Ingredient } = getModels();
        const recipes = await DrinkItemRecipe.findAll({
            where: { DrinkPromotionItemId: req.params.itemId, TenantId: req.tenant.id },
            include: [{ model: Ingredient }]
        });
        res.json(recipes);
    } catch (err) {
        console.error("[DrinkPromotions] GET recipes error:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST add/update ingredient in a DrinkPromotionItem recipe
router.post('/drink-promotions/items/:itemId/recipes', async (req, res) => {
    try {
        const { DrinkItemRecipe, Ingredient } = getModels();
        const { ingredientId, quantity, presentation } = req.body;
        if (!ingredientId || !quantity) return res.status(400).json({ error: 'ingredientId y quantity son requeridos' });

        const whereClause = {
            DrinkPromotionItemId: req.params.itemId,
            IngredientId: ingredientId,
            presentation: presentation || null
        };

        const existing = await DrinkItemRecipe.findOne({ where: whereClause });
        if (existing) {
            existing.quantity = quantity;
            await existing.save();
            const withIng = await DrinkItemRecipe.findByPk(existing.id, { include: [{ model: Ingredient }] });
            return res.json(withIng);
        }

        const newRecipe = await DrinkItemRecipe.create({
            DrinkPromotionItemId: req.params.itemId,
            IngredientId: ingredientId,
            quantity,
            presentation: presentation || null,
            TenantId: req.tenant.id
        });
        const withIng = await DrinkItemRecipe.findByPk(newRecipe.id, { include: [{ model: Ingredient }] });
        res.json(withIng);
    } catch (err) {
        console.error("[DrinkPromotions] POST recipe error:", err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE a DrinkItemRecipe entry
router.delete('/drink-promotions/items/recipes/:recipeId', async (req, res) => {
    try {
        const { DrinkItemRecipe } = getModels();
        await DrinkItemRecipe.destroy({ where: { id: req.params.recipeId, TenantId: req.tenant.id } });
        res.json({ success: true });
    } catch (err) {
        console.error("[DrinkPromotions] DELETE recipe error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

