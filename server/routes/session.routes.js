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
            include: [
                {
                    model: Account,
                    include: [{ model: Table }]
                },
                {
                    model: User,
                    attributes: ['id', 'username', 'displayName']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const expenses = await Expense.findAll({
            where: { CashSessionId: activeSession.id },
            include: [
                {
                    model: User,
                    attributes: ['id', 'username', 'displayName']
                }
            ]
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
            "2x1 / Promos": { count: 0, total: 0, items: [] },
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
                let category = 'otros';
                let itemName = '';
                let itemPresentation = order.presentation;
                
                if (order.Product) {
                    itemName = order.Product.name;
                    const type = order.Product.type;
                    
                    if (['menu', 'daily_entry', 'daily_main'].includes(type)) {
                        category = 'menus';
                    } else if (type === 'dish') {
                        category = 'platos';
                    } else if (type === 'drink') {
                        category = 'bebidas';
                    }
                } else {
                    category = '2x1 / Promos';
                    itemName = order.notes || 'Promo/Combo';
                }

                let itemPrice = parseFloat(order.priceAtOrder || (order.Product ? order.Product.price : 0));
                let itemTotal = itemPrice * order.quantity;

                salesSummary[category].count += order.quantity;
                salesSummary[category].total += itemTotal;
                
                const existingItem = salesSummary[category].items.find(
                    i => i.name === itemName && i.presentation === itemPresentation
                );
                
                if (existingItem) {
                    existingItem.quantity += order.quantity;
                    existingItem.total += itemTotal;
                } else {
                    salesSummary[category].items.push({
                        name: itemName,
                        presentation: itemPresentation,
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
            expenses,
            salesSummary
        });

    } catch (error) {
        console.error("Error fetching current session:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/sessions/:id/details - Get details for any session (current or historic)
router.get('/sessions/:id/details', async (req, res) => {
    try {
        const session = await CashSession.findByPk(req.params.id, {
            include: [
                { model: User, as: 'Opener', attributes: ['id', 'username', 'displayName'] },
                { model: User, as: 'Closer', attributes: ['id', 'username', 'displayName'] }
            ]
        });

        if (!session) {
            return res.status(404).json({ error: 'Sesión no encontrada' });
        }

        // Calculate expected totals
        const payments = await Payment.findAll({
            where: { CashSessionId: session.id },
            include: [
                {
                    model: Account,
                    include: [{ model: Table }]
                },
                {
                    model: User,
                    attributes: ['id', 'username', 'displayName']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const expenses = await Expense.findAll({
            where: { CashSessionId: session.id },
            include: [
                {
                    model: User,
                    attributes: ['id', 'username', 'displayName']
                }
            ]
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
            efectivo: parseFloat(session.openingCash) + paymentTotals.efectivo - expenseTotals.efectivo,
            tarjeta: paymentTotals.tarjeta,
            yape: paymentTotals.yape,
            transferencia: paymentTotals.transferencia
        };

        // --- Calculate Sales Summary ---
        const accountIds = [...new Set(payments.map(p => p.AccountId).filter(id => id != null))];

        let salesSummary = {
            menus: { count: 0, total: 0, items: [] },
            platos: { count: 0, total: 0, items: [] },
            bebidas: { count: 0, total: 0, items: [] },
            "2x1 / Promos": { count: 0, total: 0, items: [] },
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
                let category = 'otros';
                let itemName = '';
                let itemPresentation = order.presentation;
                
                if (order.Product) {
                    itemName = order.Product.name;
                    const type = order.Product.type;
                    
                    if (['menu', 'daily_entry', 'daily_main'].includes(type)) {
                        category = 'menus';
                    } else if (type === 'dish') {
                        category = 'platos';
                    } else if (type === 'drink') {
                        category = 'bebidas';
                    }
                } else {
                    category = '2x1 / Promos';
                    itemName = order.notes || 'Promo/Combo';
                }

                let itemPrice = parseFloat(order.priceAtOrder || (order.Product ? order.Product.price : 0));
                let itemTotal = itemPrice * order.quantity;

                salesSummary[category].count += order.quantity;
                salesSummary[category].total += itemTotal;
                
                const existingItem = salesSummary[category].items.find(
                    i => i.name === itemName && i.presentation === itemPresentation
                );
                
                if (existingItem) {
                    existingItem.quantity += order.quantity;
                    existingItem.total += itemTotal;
                } else {
                    salesSummary[category].items.push({
                        name: itemName,
                        presentation: itemPresentation,
                        quantity: order.quantity,
                        price: itemPrice,
                        total: itemTotal
                    });
                }
            });
        }

        res.json({
            session,
            expected,
            paymentTotals,
            expenseTotals,
            payments,
            expenses,
            salesSummary
        });

    } catch (error) {
        console.error("Error fetching session details:", error);
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

        // Print opening ticket in background
        (async () => {
            try {
                const { triggerAperturaPrint } = require('../utils/printer');
                const openerUser = userId ? await User.findByPk(userId) : null;
                await triggerAperturaPrint(newSession, openerUser);
            } catch (pErr) {
                console.error("Error printing opening session ticket:", pErr);
            }
        })();

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

        if (!closingNotes || closingNotes.trim() === '') {
            return res.status(400).json({ error: 'Es obligatorio ingresar las notas de cierre' });
        }

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

        // Print closing report in background
        (async () => {
            try {
                const parsedDetails = typeof session.closingDetails === 'string' ? JSON.parse(session.closingDetails) : session.closingDetails;
                
                const payments = await Payment.findAll({
                    where: { CashSessionId: session.id },
                    include: [{ model: Account, include: [{ model: Table }] }]
                });

                const expenses = await Expense.findAll({
                    where: { CashSessionId: session.id }
                });

                const paymentTotals = { efectivo: 0, tarjeta: 0, yape: 0, transferencia: 0 };
                payments.forEach(p => {
                    const method = p.method ? p.method.toLowerCase() : 'efectivo';
                    if (paymentTotals[method] !== undefined) paymentTotals[method] += parseFloat(p.amount);
                    else paymentTotals[method] = parseFloat(p.amount);
                });

                const expenseTotals = { efectivo: 0, yape: 0, transferencia: 0 };
                expenses.forEach(e => {
                    const method = e.paymentMethod ? e.paymentMethod.toLowerCase() : 'efectivo';
                    if (expenseTotals[method] !== undefined) expenseTotals[method] += parseFloat(e.amount);
                });

                const expected = {
                    efectivo: parseFloat(session.openingCash) + paymentTotals.efectivo - expenseTotals.efectivo,
                    efectivoIn: paymentTotals.efectivo,
                    efectivoOut: expenseTotals.efectivo,
                    tarjeta: paymentTotals.tarjeta,
                    yape: paymentTotals.yape,
                    transferencia: paymentTotals.transferencia
                };

                const accountIds = [...new Set(payments.map(p => p.AccountId).filter(id => id != null))];
                let salesSummary = {
                    menus: { count: 0, total: 0 },
                    platos: { count: 0, total: 0 },
                    bebidas: { count: 0, total: 0 },
                    "2x1 / Promos": { count: 0, total: 0 },
                    otros: { count: 0, total: 0 }
                };

                if (accountIds.length > 0) {
                    const orders = await Order.findAll({
                        where: { AccountId: { [Op.in]: accountIds }, status: { [Op.notIn]: ['cancelled'] } },
                        include: [{ model: Product }]
                    });

                    orders.forEach(order => {
                        let category = 'otros';
                        if (order.Product) {
                            const type = order.Product.type;
                            if (['menu', 'daily_entry', 'daily_main'].includes(type)) category = 'menus';
                            else if (type === 'dish') category = 'platos';
                            else if (type === 'drink') category = 'bebidas';
                        } else {
                            category = '2x1 / Promos';
                        }
                        let itemPrice = parseFloat(order.priceAtOrder || (order.Product ? order.Product.price : 0));
                        let itemTotal = itemPrice * order.quantity;
                        salesSummary[category].count += order.quantity;
                        salesSummary[category].total += itemTotal;
                    });
                }
                expected.salesSummary = salesSummary;

                const { triggerCierrePrint } = require('../utils/printer');
                const closerUser = userId ? await User.findByPk(userId) : null;
                await triggerCierrePrint(session, expected, parsedDetails, closerUser);
            } catch (pErr) {
                console.error("Error printing closing session report:", pErr);
            }
        })();

        res.json({ success: true, session });
    } catch (error) {
        console.error("Error closing session:", error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/sessions/:id/print - Reprint closing report of any session
router.post('/sessions/:id/print', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, type } = req.body;

        const session = await CashSession.findByPk(id, {
            include: [
                { model: User, as: 'Opener', attributes: ['id', 'username', 'displayName'] },
                { model: User, as: 'Closer', attributes: ['id', 'username', 'displayName'] }
            ]
        });

        if (!session) {
            return res.status(404).json({ error: 'Sesión no encontrada' });
        }

        // Handle Apertura reprint
        if (type === 'apertura') {
            const { triggerAperturaPrint } = require('../utils/printer');
            const printResult = await triggerAperturaPrint(session, session.Opener);

            if (printResult.success) {
                return res.json({ success: true, message: 'Ticket de apertura enviado a la impresora.' });
            } else if (printResult.error === 'disabled') {
                return res.status(400).json({ error: 'La impresora de Caja esta deshabilitada.' });
            } else {
                return res.status(500).json({ error: 'Fallo el envio a la impresora.', details: printResult.error });
            }
        }

        const payments = await Payment.findAll({
            where: { CashSessionId: session.id },
            include: [{ model: Account, include: [{ model: Table }] }]
        });

        const expenses = await Expense.findAll({
            where: { CashSessionId: session.id }
        });

        const paymentTotals = { efectivo: 0, tarjeta: 0, yape: 0, transferencia: 0 };
        payments.forEach(p => {
            const method = p.method ? p.method.toLowerCase() : 'efectivo';
            if (paymentTotals[method] !== undefined) paymentTotals[method] += parseFloat(p.amount);
            else paymentTotals[method] = parseFloat(p.amount);
        });

        const expenseTotals = { efectivo: 0, yape: 0, transferencia: 0 };
        expenses.forEach(e => {
            const method = e.paymentMethod ? e.paymentMethod.toLowerCase() : 'efectivo';
            if (expenseTotals[method] !== undefined) expenseTotals[method] += parseFloat(e.amount);
        });

        const expected = {
            efectivo: parseFloat(session.openingCash) + paymentTotals.efectivo - expenseTotals.efectivo,
            efectivoIn: paymentTotals.efectivo,
            efectivoOut: expenseTotals.efectivo,
            tarjeta: paymentTotals.tarjeta,
            yape: paymentTotals.yape,
            transferencia: paymentTotals.transferencia
        };

        const accountIds = [...new Set(payments.map(p => p.AccountId).filter(id => id != null))];
        let salesSummary = {
            menus: { count: 0, total: 0 },
            platos: { count: 0, total: 0 },
            bebidas: { count: 0, total: 0 },
            "2x1 / Promos": { count: 0, total: 0 },
            otros: { count: 0, total: 0 }
        };

        if (accountIds.length > 0) {
            const orders = await Order.findAll({
                where: { AccountId: { [Op.in]: accountIds }, status: { [Op.notIn]: ['cancelled'] } },
                include: [{ model: Product }]
            });

            orders.forEach(order => {
                let category = 'otros';
                if (order.Product) {
                    const type = order.Product.type;
                    if (['menu', 'daily_entry', 'daily_main'].includes(type)) category = 'menus';
                    else if (type === 'dish') category = 'platos';
                    else if (type === 'drink') category = 'bebidas';
                } else {
                    category = '2x1 / Promos';
                }
                let itemPrice = parseFloat(order.priceAtOrder || (order.Product ? order.Product.price : 0));
                let itemTotal = itemPrice * order.quantity;
                salesSummary[category].count += order.quantity;
                salesSummary[category].total += itemTotal;
            });
        }
        expected.salesSummary = salesSummary;

        const parsedDetails = session.closingDetails ? JSON.parse(session.closingDetails) : null;
        const userObj = userId ? await User.findByPk(userId) : null;

        const { triggerCierrePrint } = require('../utils/printer');
        const printResult = await triggerCierrePrint(session, expected, parsedDetails, userObj);

        if (printResult.success) {
            res.json({ success: true, message: 'Reporte de cierre enviado a la impresora.' });
        } else if (printResult.error === 'disabled') {
            res.status(400).json({ error: 'La impresora de Caja esta deshabilitada.' });
        } else {
            res.status(500).json({ error: 'Fallo el envio a la impresora.', details: printResult.error });
        }
    } catch (err) {
        console.error("Error reprinting cierre:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
