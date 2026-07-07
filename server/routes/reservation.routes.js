const express = require('express');
const router = express.Router();
const { Reservation, Table, Op } = require('../models');

// Get all reservations (optionally filter by date or status)
router.get('/', async (req, res) => {
    try {
        const { date, status } = req.query;
        const where = { TenantId: req.tenant.id };

        if (status) where.status = status;

        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            where.reservationTime = { [require('sequelize').Op.between]: [start, end] };
        }

        const reservations = await Reservation.findAll({
            where,
            include: [{ model: Table, include: [require('../models').Area] }],
            order: [['reservationTime', 'ASC']]
        });
        res.json(reservations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Reservation
router.post('/', async (req, res) => {
    try {
        const { customerName, contactInfo, reservationTime, tableId, notes } = req.body;

        // Basic conflict check (simplistic: check if table is reserved at same time +/- 1 hour)
        // For Phase 4 prototype, we might skip complex conflict logic or just warn.

        const newReservation = await Reservation.create({
            customerName,
            contactInfo,
            reservationTime,
            TableId: tableId,
            notes,
            status: 'confirmed',
            TenantId: req.tenant.id
        });

        res.json(newReservation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Status (e.g. Cancel, Fulfill)
router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const reservation = await Reservation.findOne({ where: { id: req.params.id, TenantId: req.tenant.id } });
        if (!reservation) return res.status(404).json({ error: 'Reserva no encontrada' });

        reservation.status = status;
        await reservation.save();
        res.json(reservation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Customer History (Count visits based on Name)
// This fulfills "Customer Tracking" partially.
router.get('/customer-history', async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) return res.json({ count: 0 });

        // Count in Reservations (scoped to tenant)
        const reservationCount = await Reservation.count({
            where: { customerName: { [require('sequelize').Op.like]: `%${name}%` }, TenantId: req.tenant.id }
        });

        // Count in Closed Accounts (if we tracked names there too, which we do)
        // We'll have to import Account
        const { Account } = require('../models');
        const accountCount = await Account.count({
            where: {
                customerName: { [require('sequelize').Op.like]: `%${name}%` },
                status: 'closed',
                TenantId: req.tenant.id
            }
        });

        res.json({
            name,
            reservationCount,
            visitCount: accountCount,
            totalInteractions: reservationCount + accountCount,
            isFrequent: (accountCount + reservationCount) > 5
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
