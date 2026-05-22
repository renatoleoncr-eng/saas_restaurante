const express = require('express');
const router = express.Router();
// Use dynamic require to prevent circular dependencies
const getModels = () => require('../models');
const { Op } = require('sequelize');
const { getHotelDayRange } = require('../utils/dateUtils');

// GET /api/accounts/all - Fetch all accounts with filtering
router.get('/accounts/all', async (req, res) => {
    try {
        const { sequelize } = getModels();
        const { startDate, status, search } = req.query;

        console.log(`[Account] Fetching accounts with filters:`, { startDate, status, search });

        // Use Hotel Day Logic (7 AM to 6:59:59 AM next day)
        // If no startDate provided, getHotelDayRange defaults to today's hotel day
        const [start, end] = getHotelDayRange(startDate, startDate);
        const startISO = start.toISOString();

        // Build date filter (Allow 'open' accounts to bypass the date filter so they are never hidden)
        let dateFilter = `AND (a.createdAt >= '${startISO}' OR a.status = 'open')`;

        // Status filter
        let statusFilter = '';
        if (status && status !== 'all') {
            statusFilter = `AND a.status = '${status}'`;
        }

        // Search filter
        let searchFilter = '';
        if (search) {
            const searchNum = parseInt(search);
            if (!isNaN(searchNum)) {
                searchFilter = `AND (a.id = ${searchNum} OR a.customerName LIKE '%${search}%')`;
            } else {
                searchFilter = `AND a.customerName LIKE '%${search}%'`;
            }
        }

        const query = `
            SELECT 
                a.id, a.status, a.total, a.customerName, a.clientDni, a.clientAddress, a.paymentMethod, a.paymentEvidence,
                a.openedAt, a.closedAt, a.createdAt, a.updatedAt, a.TableId, a.accountType,
                t.number as tableNumber,
                ar.name as areaName,
                COALESCE((SELECT SUM(p.amount) FROM Payments p WHERE p.AccountId = a.id), 0) as totalPaid
            FROM Accounts a
            LEFT JOIN Tables t ON t.id = a.TableId
            LEFT JOIN Areas ar ON ar.id = t.AreaId
            WHERE 1=1 ${dateFilter} ${statusFilter} ${searchFilter}
            ORDER BY a.createdAt DESC
        `;

        const [accounts] = await sequelize.query(query);

        // Fetch all payments for the retrieved accounts
        const accountIds = accounts.map(a => a.id);
        const { Payment } = getModels();
        let paymentsByAccount = {};
        if (accountIds.length > 0) {
            const payments = await Payment.findAll({
                where: { AccountId: { [Op.in]: accountIds } }
            });
            payments.forEach(p => {
                if (!paymentsByAccount[p.AccountId]) paymentsByAccount[p.AccountId] = [];
                paymentsByAccount[p.AccountId].push(p);
            });
        }

        const formattedAccounts = accounts.map(acc => {
            const totalAmount = parseFloat(acc.total || 0);
            const totalPaid = parseFloat(acc.totalPaid || 0);
            const deuda = Math.max(0, totalAmount - totalPaid);
            return {
                ...acc,
                totalPaid,
                deuda,
                Payments: paymentsByAccount[acc.id] || [],
                Table: acc.TableId ? { id: acc.TableId, number: acc.tableNumber || acc.tablenumber, Area: { name: acc.areaName || acc.areaname } } : null
            };
        });

        res.json(formattedAccounts);
    } catch (error) {
        console.error("[Account] ERROR fetching accounts:", error);
        res.status(500).json({ error: error.message });
    }
});

// DEL /api/accounts/:id - Soft or hard delete an account
router.delete('/accounts/:id', async (req, res) => {
    const { sequelize, Account, Order, Payment, Table } = getModels();
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;

        const account = await Account.findByPk(id, { transaction: t });
        if (!account) {
            await t.rollback();
            return res.status(404).json({ error: "Cuenta no encontrada" });
        }

        // Free the table if the account was occupying it
        if (account.TableId) {
            const table = await Table.findByPk(account.TableId, { transaction: t });
            if (table && table.status === 'occupied') {
                table.status = 'free';
                await table.save({ transaction: t });
            }
        }

        // Delete associated orders and payments (or let cascading handle if configured, but explicit is safer)
        await Payment.destroy({ where: { AccountId: id }, transaction: t });
        await Order.destroy({ where: { AccountId: id }, transaction: t });
        await account.destroy({ transaction: t });

        await t.commit();

        // Notify Frontend to refresh tables
        const io = req.app.get('io');
        if (io) {
            io.emit('table_updated', { tableId: account.TableId, status: 'free' });
        }

        res.json({ success: true, message: "Cuenta eliminada correctamente" });
    } catch (error) {
        await t.rollback();
        console.error("[Account] ERROR deleting account:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/accounts/specific/:id - Fetch a specific account history by ID 
router.get('/accounts/specific/:id', async (req, res) => {
    try {
        const { Account, Order, Product } = getModels();
        const { id } = req.params;

        const account = await Account.findByPk(id, {
            include: [
                { model: Order, include: [Product] },
                { model: getModels().Payment },
                { model: getModels().Table, include: [getModels().Area] }
            ]
        });

        if (!account) return res.status(404).json({ error: "Cuenta no encontrada" });
        res.json(account);
    } catch (err) {
        console.error("Error fetching specific account:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
