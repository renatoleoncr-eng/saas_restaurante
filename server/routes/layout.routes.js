const express = require('express');
const router = express.Router();

// Local require helper to avoid circular dependencies
const getModels = () => require('../models');

console.log('Layout Routes Loaded.');

// --- AREAS (Rows) ---

// Get all areas with tables
router.get('/areas', async (req, res) => {
    try {
        const { Area, Table } = getModels();
        const areas = await Area.findAll({
            include: [{ model: Table }],
            order: [['sortOrder', 'ASC']]
        });

        // Sort tables numerically by number (since it's a string)
        const areasWithSortedTables = areas.map(area => {
            const areaJson = area.toJSON();
            if (areaJson.Tables && areaJson.Tables.length > 0) {
                areaJson.Tables.sort((a, b) => {
                    const numA = parseInt(a.number) || 0;
                    const numB = parseInt(b.number) || 0;
                    return numA - numB;
                });
            }
            return areaJson;
        });

        res.json(areasWithSortedTables);
    } catch (err) {
        console.error("Error in GET /areas:", err);
        res.status(500).json({ error: err.message });
    }
});

// ... (other handlers)

// Create Area
router.post('/areas', async (req, res) => {
    try {
        const { Area } = getModels();
        const { name, sortOrder } = req.body;
        const area = await Area.create({ name, sortOrder });
        res.json(area);
    } catch (err) {
        console.error("Error in POST /areas:", err);
        res.status(500).json({ error: err.message });
    }
});

// Update Area
router.put('/areas/:id', async (req, res) => {
    try {
        const { Area } = getModels();
        const { id } = req.params;
        const { name, sortOrder } = req.body;
        await Area.update({ name, sortOrder }, { where: { id } });
        res.json({ success: true });
    } catch (err) {
        console.error("Error in PUT /areas:", err);
        res.status(500).json({ error: err.message });
    }
});

// Delete Area
router.delete('/areas/:id', async (req, res) => {
    try {
        const { Area } = getModels();
        const { id } = req.params;
        await Area.destroy({ where: { id } });
        res.json({ success: true });
    } catch (err) {
        console.error("Error in DELETE /areas:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- TABLES ---

// Get All Tables (Optional specific Area)
router.get('/tables', async (req, res) => {
    try {
        const { Table } = getModels();
        const { areaId } = req.query;
        const where = {};
        if (areaId) {
            where.AreaId = areaId;
        }

        const tables = await Table.findAll({
            where,
            include: [{ model: getModels().Area }],
            order: [['number', 'ASC']]
        });

        // Improve sort if number is string digit
        tables.sort((a, b) => {
            return (parseInt(a.number) || 0) - (parseInt(b.number) || 0);
        });

        res.json(tables);
    } catch (err) {
        console.error("Error in GET /tables:", err);
        res.status(500).json({ error: err.message });
    }
});

// Create Table
router.post('/tables', async (req, res) => {
    try {
        const { Table } = getModels();
        const { number, AreaId, x, y } = req.body;

        // Validation for uniqueness per area
        const existing = await Table.findOne({ where: { number: String(number), AreaId } });
        if (existing) {
            return res.status(400).json({ error: `Ya existe una mesa con el número '${number}' en esta categoría/área.` });
        }

        const table = await Table.create({ number: String(number), AreaId, x, y });
        res.json(table);
    } catch (err) {
        console.error("Error in POST /tables:", err);
        res.status(500).json({ error: err.message });
    }
});

// Update Table
router.put('/tables/:id', async (req, res) => {
    try {
        const { Table } = getModels();
        const { id } = req.params;
        const { number, x, y, status } = req.body;

        const currentTable = await Table.findByPk(id);
        if (!currentTable) return res.status(404).json({ error: "Mesa no encontrada" });

        // Uniqueness validation if number is changing
        if (number !== undefined && String(number) !== currentTable.number) {
            const existing = await Table.findOne({ where: { number: String(number), AreaId: currentTable.AreaId } });
            if (existing) {
                return res.status(400).json({ error: `Ya existe una mesa con el número '${number}' en esta categoría/área.` });
            }
        }

        await Table.update(
            { number: number !== undefined ? String(number) : currentTable.number, x, y, status },
            { where: { id } }
        );
        const io = req.app.get('io');
        if (io && status !== undefined) {
            io.emit('table_updated', { tableId: id, status });
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Error in PUT /tables:", err);
        res.status(500).json({ error: err.message });
    }
});

// Delete Table
router.delete('/tables/:id', async (req, res) => {
    try {
        const { Table, Account } = getModels();
        const { id } = req.params;

        // Check if table has an open account
        const openAccount = await Account.findOne({
            where: {
                TableId: id,
                status: 'open'
            }
        });

        if (openAccount) {
            return res.status(400).json({
                error: 'No se puede eliminar una mesa con cuenta abierta. Cierra la cuenta primero.'
            });
        }

        await Table.destroy({ where: { id } });
        res.json({ success: true });
    } catch (err) {
        console.error("Error in DELETE /tables:", err);
        res.status(500).json({ error: err.message });
    }
});

// Get Table Details (inc current account)
router.get('/tables/:id', async (req, res) => {
    try {
        const { Table, Account } = getModels();
        const { id } = req.params;
        const { Area } = getModels();
        const table = await Table.findByPk(id, {
            include: [
                {
                    model: Account,
                    where: { status: 'open' },
                    required: false
                },
                { model: Area }
            ]
        });
        res.json(table);
    } catch (err) {
        console.error("Error in GET /tables/:id:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
