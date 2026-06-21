const express = require('express');
const router = express.Router();
const { Expense, User } = require('../models');
const { getHotelDayRange } = require('../utils/dateUtils');

// GET All Expenses (filterable by date range via query)
router.get('/expenses', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const where = {};

        // Use Hotel Day Logic (7 AM to 6:59:59 AM next day)
        const [start, end] = getHotelDayRange(startDate, endDate);
        const { Op } = require('sequelize');
        where.date = { [Op.between]: [start, end] };

        const expenses = await Expense.findAll({
            where,
            include: [{ model: User, attributes: ['username', 'displayName'] }],
            order: [['date', 'DESC']]
        });
        res.json(expenses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CREATE Expense
router.post('/expenses', async (req, res) => {
    try {
        const { description, amount, category, userId, date } = req.body;
        const paymentMethod = 'efectivo'; // Always force cash
        const { Payment, Expense, CashSession } = require('../models');

        const activeSession = await CashSession.findOne({ where: { status: 'open' } });
        const CashSessionId = activeSession ? activeSession.id : null;

        // Validation: Prevent negative cash
        if (paymentMethod === 'efectivo') {
            if (!activeSession) {
                return res.status(400).json({
                    error: 'No se pueden registrar egresos en efectivo si no hay un turno de caja abierto.'
                });
            }

            const sessionPayments = await Payment.findAll({
                where: { 
                    method: 'efectivo',
                    CashSessionId: activeSession.id
                },
                attributes: ['amount']
            });
            const sessionCashIncome = sessionPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

            const sessionExpenses = await Expense.findAll({
                where: { 
                    paymentMethod: 'efectivo',
                    CashSessionId: activeSession.id
                },
                attributes: ['amount']
            });
            const sessionCashOutcome = sessionExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

            const sessionAvailableCash = parseFloat(activeSession.openingCash) + sessionCashIncome - sessionCashOutcome;

            if (parseFloat(amount) > sessionAvailableCash) {
                return res.status(400).json({
                    error: `Saldo insuficiente en caja del turno activo. Efectivo disponible: S/ ${sessionAvailableCash.toFixed(2)}`
                });
            }
        }

        const expense = await Expense.create({
            description,
            amount,
            category,
            paymentMethod,
            UserId: userId,
            date: date || new Date(),
            CashSessionId
        });

        res.json(expense);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE Expense (Admin Only)
router.delete('/expenses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query; // Expecting admin userId for validation or check role in session
        const { Expense, User } = require('../models');

        const user = await User.findByPk(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Solo los administradores pueden eliminar movimientos.' });
        }

        const expense = await Expense.findByPk(id);
        if (!expense) return res.status(404).json({ error: 'Egreso no encontrado' });

        await expense.destroy();
        res.json({ success: true, message: 'Egreso eliminado correctamente.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
