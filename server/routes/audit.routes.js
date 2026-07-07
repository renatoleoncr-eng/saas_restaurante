const express = require('express');
const router = express.Router();
const { AuditLog, User } = require('../models');
const { Op } = require('sequelize');

// GET Logs with server-side filters (Admin Only)
router.get('/audit-logs', async (req, res) => {
    try {
        const {
            userId,
            action,
            entity,
            dateFrom,
            dateTo,
            search,
            limit = 100,
            offset = 0
        } = req.query;

        const where = { TenantId: req.tenant.id };

        // Filter by userId
        if (userId) {
            where.UserId = parseInt(userId);
        }

        // Filter by action (supports partial match)
        if (action) {
            where.action = { [Op.like]: `%${action}%` };
        }

        // Filter by entity
        if (entity) {
            where.entity = entity;
        }

        // Date range filter
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
            if (dateTo) {
                const end = new Date(dateTo);
                end.setHours(23, 59, 59, 999);
                where.createdAt[Op.lte] = end;
            }
        }

        // Free-text search in details field
        if (search) {
            where.details = { [Op.like]: `%${search}%` };
        }

        const { count, rows } = await AuditLog.findAndCountAll({
            where,
            include: [{ model: User, attributes: ['id', 'username', 'displayName'] }],
            order: [['createdAt', 'DESC']],
            limit: Math.min(parseInt(limit), 500),
            offset: parseInt(offset)
        });

        res.json({ total: count, logs: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET distinct actions for filter dropdown
router.get('/audit-logs/meta', async (req, res) => {
    try {
        const tenantId = req.tenant.id;
        const actions = await AuditLog.findAll({
            where: { TenantId: tenantId },
            attributes: [[require('sequelize').fn('DISTINCT', require('sequelize').col('action')), 'action']],
            raw: true
        });
        const { User: UserModel } = require('../models');
        const users = await UserModel.findAll({
            where: { TenantId: tenantId },
            attributes: ['id', 'username', 'displayName']
        });
        res.json({ actions: actions.map(a => a.action), users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
