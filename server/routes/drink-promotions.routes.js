const express = require('express');
const router = express.Router();

const getModels = () => require('../models');

// GET all drink promotions with their items
router.get('/drink-promotions', async (req, res) => {
    try {
        const { DrinkPromotion, DrinkPromotionItem } = getModels();
        const promos = await DrinkPromotion.findAll({
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

        // Simplified uniqueness check (MySQL is case-insensitive by default)
        const existing = await DrinkPromotion.findOne({
            where: { name: name.trim() }
        });

        if (existing) return res.status(400).json({ error: `Ya existe una promoción con el nombre "${name}".` });

        const promo = await DrinkPromotion.create({ name, price, active });
        console.log("[DrinkPromotions] Promo created:", promo.id);
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
        const promo = await DrinkPromotion.findByPk(req.params.id);
        if (!promo) return res.status(404).json({ error: 'Promoción no encontrada' });
        const { name, price, active } = req.body;
        if (name !== undefined) {
            if (name.trim().toLowerCase() !== promo.name.trim().toLowerCase()) {
                const existing = await DrinkPromotion.findOne({
                    where: {
                        name: name.trim(),
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

// DELETE a promotion (cascade deletes items)
router.delete('/drink-promotions/:id', async (req, res) => {
    try {
        const { DrinkPromotion } = getModels();
        const promo = await DrinkPromotion.findByPk(req.params.id);
        if (!promo) return res.status(404).json({ error: 'Promoción no encontrada' });
        await promo.destroy();
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
        const promo = await DrinkPromotion.findByPk(req.params.id);
        if (!promo) return res.status(404).json({ error: 'Promoción no encontrada' });
        const { name, individualPrice = 0, type = 'free', linkedProductId = null } = req.body;
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
            linkedProductId,
            DrinkPromotionId: promo.id
        });
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
        const item = await DrinkPromotionItem.findByPk(req.params.itemId);
        if (!item) return res.status(404).json({ error: 'Item no encontrado' });
        const { name, individualPrice, type, linkedProductId } = req.body;
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
        if (type !== undefined) item.type = type;
        if (linkedProductId !== undefined) item.linkedProductId = linkedProductId;
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
        const item = await DrinkPromotionItem.findByPk(req.params.itemId);
        if (!item) return res.status(404).json({ error: 'Item no encontrado' });
        await item.destroy();
        res.json({ success: true });
    } catch (err) {
        console.error("[DrinkPromotions] Item DELETE Error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
