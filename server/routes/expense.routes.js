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
        const { description, amount, category, paymentMethod, userId, date } = req.body;
        const { Payment, Expense, CashSession } = require('../models');

        const activeSession = await CashSession.findOne({ where: { status: 'open' } });
        const CashSessionId = activeSession ? activeSession.id : null;

        // Validation: Prevent negative cash
        if (paymentMethod === 'efectivo') {
            const allCashPayments = await Payment.findAll({
                where: { method: 'efectivo' },
                attributes: ['amount']
            });
            const totalCashIncome = allCashPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

            const allCashExpenses = await Expense.findAll({
                where: { paymentMethod: 'efectivo' },
                attributes: ['amount']
            });
            const totalCashOutcome = allCashExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

            const currentCashBalance = totalCashIncome - totalCashOutcome;

            if (parseFloat(amount) > currentCashBalance) {
                return res.status(400).json({
                    error: `Saldo insuficiente en caja. Efectivo disponible: S/ ${currentCashBalance.toFixed(2)}`
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
