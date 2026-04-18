const express = require('express');
const router = express.Router();
const { AuditLog, User } = require('../models');

// GET Logs (Admin Only)
// In a real app we'd add middleware to check admin role here
router.get('/audit-logs', async (req, res) => {
    try {
        const logs = await AuditLog.findAll({
            include: [{ model: User, attributes: ['username', 'displayName'] }],
            order: [['createdAt', 'DESC']],
            limit: 100 // Cap for performance in prototype
        });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
