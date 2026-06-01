const express = require('express');
const router = express.Router();
const { CashSession, Payment, Expense, User, Account } = require('../models');
const { Op } = require('sequelize');

// GET /api/sessions/current - Get active session with calculated expected totals
router.get('/sessions/current', async (req, res) => {
    try {
        const activeSession = await CashSession.findOne({
            where: { status: 'open' },
            include: [
                { model: User, as: 'Opener', attributes: ['id', 'username', 'displayName'] }
            ]
        });

        if (!activeSession) {
            return res.status(404).json({ error: 'No hay sesión activa' });
        }

        // Calculate expected totals
        const payments = await Payment.findAll({
            where: { CashSessionId: activeSession.id }
        });

        const expenses = await Expense.findAll({
            where: { CashSessionId: activeSession.id }
        });

        // Group payments by method
        const paymentTotals = {
            efectivo: 0,
            tarjeta: 0,
            yape: 0,
            transferencia: 0
        };

        payments.forEach(p => {
            const method = p.method ? p.method.toLowerCase() : 'efectivo';
            if (paymentTotals[method] !== undefined) {
                paymentTotals[method] += parseFloat(p.amount);
            } else {
                // Fallback for custom methods if any
                paymentTotals[method] = parseFloat(p.amount);
            }
        });

        // Group expenses by method (to subtract from cash if needed)
        const expenseTotals = {
            efectivo: 0,
            yape: 0,
            transferencia: 0
        };

        expenses.forEach(e => {
            const method = e.paymentMethod ? e.paymentMethod.toLowerCase() : 'efectivo';
            if (expenseTotals[method] !== undefined) {
                expenseTotals[method] += parseFloat(e.amount);
            }
        });

        const expected = {
            efectivo: parseFloat(activeSession.openingCash) + paymentTotals.efectivo - expenseTotals.efectivo,
            tarjeta: paymentTotals.tarjeta,
            yape: paymentTotals.yape,
            transferencia: paymentTotals.transferencia
        };

        res.json({
            session: activeSession,
            expected,
            paymentTotals,
            expenseTotals
        });

    } catch (error) {
        console.error("Error fetching current session:", error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/sessions/open - Open a new session
router.post('/sessions/open', async (req, res) => {
    try {
        const { openingCash, userId } = req.body;

        // Check if there's already an open session
        const activeSession = await CashSession.findOne({ where: { status: 'open' } });
        if (activeSession) {
            return res.status(400).json({ error: 'Ya existe una sesión abierta' });
        }

        const newSession = await CashSession.create({
            openingCash: openingCash || 0,
            openedBy: userId,
            status: 'open',
            openedAt: new Date()
        });

        res.json(newSession);
    } catch (error) {
        console.error("Error opening session:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/sessions/history - Get history of closed sessions
router.get('/sessions/history', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const sessions = await CashSession.findAll({
            where: { status: 'closed' },
            order: [['closedAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset),
            include: [
                { model: User, as: 'Opener', attributes: ['id', 'username', 'displayName'] },
                { model: User, as: 'Closer', attributes: ['id', 'username', 'displayName'] }
            ]
        });
        res.json(sessions);
    } catch (error) {
        console.error("Error fetching sessions history:", error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/sessions/close - Close session with counted details
router.post('/sessions/close', async (req, res) => {
    try {
        const { sessionId, closingNotes, closingDetails, userId } = req.body;

        const session = await CashSession.findByPk(sessionId);
        if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
        if (session.status === 'closed') return res.status(400).json({ error: 'La sesión ya está cerrada' });

        // Prevent closure if there are open accounts/tables
        const openAccountsCount = await Account.count({
            where: { status: 'open' }
        });
        if (openAccountsCount > 0) {
            return res.status(400).json({ 
                error: 'No se puede cerrar el turno porque hay mesas con cuentas abiertas. Debe cobrar o liberar todas las mesas antes de proceder.' 
            });
        }

        session.status = 'closed';
        session.closedAt = new Date();
        session.closedBy = userId;
        session.closingNotes = closingNotes;
        session.closingDetails = typeof closingDetails === 'string' ? closingDetails : JSON.stringify(closingDetails);

        await session.save();

        res.json({ success: true, session });
    } catch (error) {
        console.error("Error closing session:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
