const express = require('express');
const router = express.Router();
const { CashSession, Payment, Expense, User, Account, Order, Product, Table } = require('../models');
const { Op } = require('sequelize');
const { logAction } = require('../utils/audit');

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
            where: { CashSessionId: activeSession.id },
            include: [{
                model: Account,
                include: [{ model: Table }]
            }],
            order: [['createdAt', 'DESC']]
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

        // --- NEW: Calculate Sales Summary ---
        const accountIds = [...new Set(payments.map(p => p.AccountId).filter(id => id != null))];

        let salesSummary = {
            menus: { count: 0, total: 0, items: [] },
            platos: { count: 0, total: 0, items: [] },
            bebidas: { count: 0, total: 0, items: [] },
            otros: { count: 0, total: 0, items: [] }
        };

        if (accountIds.length > 0) {
            const orders = await Order.findAll({
                where: {
                    AccountId: { [Op.in]: accountIds },
                    status: { [Op.notIn]: ['cancelled'] }
                },
                include: [{ model: Product }]
            });

            orders.forEach(order => {
                if (!order.Product) return;
                
                const type = order.Product.type;
                let category = 'otros';
                
                if (['menu', 'daily_entry', 'daily_main'].includes(type)) {
                    category = 'menus';
                } else if (type === 'dish') {
                    category = 'platos';
                } else if (type === 'drink') {
                    category = 'bebidas';
                }

                let itemPrice = parseFloat(order.priceAtOrder || order.Product.price);
                let itemTotal = itemPrice * order.quantity;

                salesSummary[category].count += order.quantity;
                salesSummary[category].total += itemTotal;
                
                const existingItem = salesSummary[category].items.find(
                    i => i.name === order.Product.name && i.presentation === order.presentation
                );
                
                if (existingItem) {
                    existingItem.quantity += order.quantity;
                    existingItem.total += itemTotal;
                } else {
                    salesSummary[category].items.push({
                        name: order.Product.name,
                        presentation: order.presentation,
                        quantity: order.quantity,
                        price: itemPrice,
                        total: itemTotal
                    });
                }
            });
        }

        res.json({
            session: activeSession,
            expected,
            paymentTotals,
            expenseTotals,
            payments,
            salesSummary
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

        // Audit log
        await logAction(req, 'OPEN_SHIFT', 'CashSession', newSession.id, { userId, openingCash: openingCash || 0 });

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

        // Audit log
        await logAction(req, 'CLOSE_SHIFT', 'CashSession', session.id, { userId, closingNotes, sessionId });

        res.json({ success: true, session });
    } catch (error) {
        console.error("Error closing session:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
