const express = require('express');
const router = express.Router();
const { Attendance, User } = require('../models');
const { Op } = require('sequelize');

// --- ATTENDANCE ROUTES ---

// Check-In (Entrada)
router.post('/attendance/check-in', async (req, res) => {
    try {
        const { userId } = req.body;
        const tenantId = req.tenant.id;

        const now = new Date();
        now.setHours(now.getHours() - 5);
        const today = now.toISOString().split('T')[0];

        // Check if already checked in today (scoped to tenant)
        const existing = await Attendance.findOne({
            where: {
                UserId: userId,
                date: today,
                checkOut: null,
                TenantId: tenantId
            }
        });

        if (existing) {
            return res.status(400).json({ error: 'Ya has marcado entrada hoy y sigue abierta.' });
        }

        const attendance = await Attendance.create({
            UserId: userId,
            checkIn: new Date(),
            date: today,
            TenantId: tenantId
        });

        res.json(attendance);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check-Out (Salida)
router.post('/attendance/check-out', async (req, res) => {
    try {
        const { userId } = req.body;
        const tenantId = req.tenant.id;
        const now = new Date();
        now.setHours(now.getHours() - 5);
        const today = now.toISOString().split('T')[0];

        // Find open session scoped to tenant
        const attendance = await Attendance.findOne({
            where: {
                UserId: userId,
                checkOut: null,
                TenantId: tenantId
            },
            order: [['checkIn', 'DESC']]
        });

        if (!attendance) {
            return res.status(404).json({ error: 'No tienes una entrada activa para marcar salida.' });
        }

        attendance.checkOut = new Date();
        await attendance.save();

        res.json(attendance);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Current Status for User
router.get('/attendance/status/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const tenantId = req.tenant.id;
        const active = await Attendance.findOne({
            where: {
                UserId: userId,
                checkOut: null,
                TenantId: tenantId
            },
            order: [['checkIn', 'DESC']]
        });

        res.json({ isCheckedIn: !!active, activeSession: active });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get History (filtered by User or All for Admin)
router.get('/attendance/list', async (req, res) => {
    try {
        const { userId, role } = req.query;
        const tenantId = req.tenant.id;

        let where = { TenantId: tenantId };
        if (role !== 'admin' && userId) {
            where.UserId = userId;
        }

        const logs = await Attendance.findAll({
            where,
            include: [{ model: User, where: { TenantId: tenantId }, required: false }],
            order: [['date', 'DESC'], ['checkIn', 'DESC']],
            limit: 50
        });

        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
