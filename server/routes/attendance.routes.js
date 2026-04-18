const express = require('express');
const router = express.Router();
const { Attendance, User } = require('../models');
const { Op } = require('sequelize');

// --- ATTENDANCE ROUTES ---

// Check-In (Entrada)
router.post('/attendance/check-in', async (req, res) => {
    try {
        const { userId } = req.body;

        // Check if already checked in today (optional, but good practice)
        const now = new Date();
        now.setHours(now.getHours() - 5);
        const today = now.toISOString().split('T')[0];
        const existing = await Attendance.findOne({
            where: {
                UserId: userId,
                date: today,
                checkOut: null
            }
        });

        if (existing) {
            return res.status(400).json({ error: 'Ya has marcado entrada hoy y sigue abierta.' });
        }

        const attendance = await Attendance.create({
            UserId: userId,
            checkIn: new Date(),
            date: today
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
        const now = new Date();
        now.setHours(now.getHours() - 5);
        const today = now.toISOString().split('T')[0];

        // Find open session
        const attendance = await Attendance.findOne({
            where: {
                UserId: userId,
                // date: today, // Allow closing previous days if forgotten? Let's stick to simple "Open session" logic first.
                checkOut: null
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
        const active = await Attendance.findOne({
            where: {
                UserId: userId,
                checkOut: null
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

        let where = {};
        if (role !== 'admin' && userId) {
            where.UserId = userId;
        }

        // Default last 7 days? Or all? Let's get "recent" for now.
        const logs = await Attendance.findAll({
            where,
            include: [User],
            order: [['date', 'DESC'], ['checkIn', 'DESC']],
            limit: 50
        });

        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
