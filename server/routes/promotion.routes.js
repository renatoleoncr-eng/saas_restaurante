const express = require('express');
const router = express.Router();
const { Promotion, PromotionGroup } = require('../models');
const appEmitter = require('../utils/emitter');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for Promotion uploads
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'promo-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

/* =========================================================================
   PROMOTION GROUPS ROUTES
   ========================================================================= */

// GET all groups with their images
router.get('/groups', async (req, res) => {
    try {
        const groups = await PromotionGroup.findAll({
            include: [{
                model: Promotion,
                as: 'Images',
                attributes: ['id', 'name', 'imageUrl', 'isActive', 'orderIndex']
            }],
            order: [
                ['orderIndex', 'ASC'],
                [{ model: Promotion, as: 'Images' }, 'orderIndex', 'ASC']
            ]
        });
        res.json(groups);
    } catch (error) {
        console.error('Error fetching promotion groups:', error);
        res.status(500).json({ error: error.message });
    }
});

// CREATE a promotion group
router.post('/groups', async (req, res) => {
    try {
        const group = await PromotionGroup.create(req.body);
        
        // Notify client screen of configuration changes
        appEmitter.emit('promotions_config_changed');

        res.status(201).json(group);
    } catch (error) {
        console.error('Error creating promotion group:', error);
        res.status(400).json({ error: error.message });
    }
});

// REORDER promotion groups
router.put('/groups/reorder', async (req, res) => {
    try {
        const { items } = req.body;
        for (const item of items) {
            await PromotionGroup.update({ orderIndex: item.orderIndex }, { where: { id: item.id } });
        }

        appEmitter.emit('promotions_config_changed');

        res.json({ message: 'Orden de grupos actualizado correctamente' });
    } catch (error) {
        console.error('Error reordering promotion groups:', error);
        res.status(500).json({ error: error.message });
    }
});

// UPDATE a promotion group
router.put('/groups/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await PromotionGroup.update(req.body, { where: { id } });
        if (updated) {
            const updatedGroup = await PromotionGroup.findByPk(id);
            
            appEmitter.emit('promotions_config_changed');

            return res.json(updatedGroup);
        }
        res.status(404).json({ error: 'Grupo no encontrado' });
    } catch (error) {
        console.error('Error updating promotion group:', error);
        res.status(400).json({ error: error.message });
    }
});

// DELETE a promotion group
router.delete('/groups/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Find associated images and delete physical files
        const promotions = await Promotion.findAll({ where: { groupId: id } });
        for (const promo of promotions) {
            if (promo.imageUrl) {
                const filePath = path.join(__dirname, '..', promo.imageUrl);
                if (fs.existsSync(filePath)) {
                    try { fs.unlinkSync(filePath); } catch (e) {}
                }
            }
            await promo.destroy();
        }

        const deleted = await PromotionGroup.destroy({ where: { id } });
        if (deleted) {
            appEmitter.emit('promotions_config_changed');
            return res.status(204).send();
        }
        res.status(404).json({ error: 'Grupo no encontrado' });
    } catch (error) {
        console.error('Error deleting promotion group:', error);
        res.status(400).json({ error: error.message });
    }
});


/* =========================================================================
   PROMOTIONS (IMAGES/SLIDES) ROUTES
   ========================================================================= */

// GET active promotions (nested inside active groups)
router.get('/active', async (req, res) => {
    try {
        const promotions = await Promotion.findAll({
            where: { isActive: true },
            include: [{
                model: PromotionGroup,
                as: 'Group',
                where: { isActive: true },
                required: true // Must have an active group
            }],
            order: [
                ['Group', 'orderIndex', 'ASC'],
                ['orderIndex', 'ASC'],
                ['createdAt', 'DESC']
            ]
        });
        res.json(promotions);
    } catch (error) {
        console.error('Error fetching active promotions:', error);
        res.status(500).json({ error: 'Error al obtener promociones activas' });
    }
});

// GET all promotions (optionally filtered by groupId)
router.get('/', async (req, res) => {
    try {
        const { groupId } = req.query;
        const where = {};
        if (groupId) where.groupId = groupId;

        const promotions = await Promotion.findAll({
            where,
            order: [['orderIndex', 'ASC'], ['createdAt', 'DESC']]
        });
        res.json(promotions);
    } catch (error) {
        console.error('Error fetching promotions:', error);
        res.status(500).json({ error: 'Error al obtener promociones' });
    }
});

// CREATE / UPLOAD bulk promotions
router.post('/', upload.array('image', 10), async (req, res) => {
    try {
        const { name, orderIndex, groupId } = req.body;
        const files = req.files || [];

        if (files.length === 0) {
            return res.status(400).json({ error: 'Al menos una imagen es requerida' });
        }

        const createdPromotions = [];
        for (const file of files) {
            const imageUrl = `/uploads/${file.filename}`;
            const promotion = await Promotion.create({
                name: name || file.originalname,
                imageUrl,
                orderIndex: orderIndex || 0,
                groupId: groupId || null,
                isActive: true
            });
            createdPromotions.push(promotion);
        }

        appEmitter.emit('promotions_config_changed');

        res.status(201).json(files.length === 1 ? createdPromotions[0] : createdPromotions);
    } catch (error) {
        console.error('Error creating promotion:', error);
        res.status(500).json({ error: 'Error al crear la promoción' });
    }
});

// REORDER promotions
router.put('/reorder', async (req, res) => {
    try {
        const { items } = req.body;
        for (const item of items) {
            await Promotion.update({ orderIndex: item.orderIndex }, { where: { id: item.id } });
        }

        appEmitter.emit('promotions_config_changed');

        res.json({ message: 'Orden de promociones actualizado correctamente' });
    } catch (error) {
        console.error('Error reordering promotions:', error);
        res.status(500).json({ error: error.message });
    }
});

// UPDATE a promotion
router.put('/:id', upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, isActive, orderIndex } = req.body;
        
        const promotion = await Promotion.findByPk(id);
        if (!promotion) {
            return res.status(404).json({ error: 'Promoción no encontrada' });
        }

        if (name !== undefined) promotion.name = name;
        if (isActive !== undefined) promotion.isActive = (isActive === 'true' || isActive === true);
        if (orderIndex !== undefined) promotion.orderIndex = orderIndex;

        // If file is updated, delete previous physical file
        if (req.file) {
            if (promotion.imageUrl) {
                const oldPath = path.join(__dirname, '..', promotion.imageUrl);
                if (fs.existsSync(oldPath)) {
                    try { fs.unlinkSync(oldPath); } catch (e) {}
                }
            }
            promotion.imageUrl = `/uploads/${req.file.filename}`;
        }

        await promotion.save();

        appEmitter.emit('promotions_config_changed');

        res.json(promotion);
    } catch (error) {
        console.error('Error updating promotion:', error);
        res.status(500).json({ error: 'Error al actualizar la promoción' });
    }
});

// DELETE a promotion
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const promotion = await Promotion.findByPk(id);

        if (!promotion) {
            return res.status(404).json({ error: 'Promoción no encontrada' });
        }

        // Delete physical file
        if (promotion.imageUrl) {
            const filePath = path.join(__dirname, '..', promotion.imageUrl);
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch (e) {}
            }
        }

        await promotion.destroy();

        appEmitter.emit('promotions_config_changed');

        res.json({ message: 'Promoción eliminada correctamente' });
    } catch (error) {
        console.error('Error deleting promotion:', error);
        res.status(500).json({ error: 'Error al eliminar la promoción' });
    }
});

module.exports = router;
