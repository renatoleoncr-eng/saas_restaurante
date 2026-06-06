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
        // MySQL (production) uses timezone: '-05:00' (Lima) per db.js config, so dates are
        // stored in Lima local time. We must compare against Lima-formatted time strings,
        // NOT UTC. Convert: start is e.g. 12:00 UTC (= 7:00 AM Lima), subtract 5h → 07:00 UTC
        // so toISOString gives '2026-06-05 07:00:00.000' which matches Lima-stored values.
        const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
        const startLima = new Date(start.getTime() - LIMA_OFFSET_MS);
        const startStr = startLima.toISOString().replace('T', ' ').replace('Z', '');

        // Build date filter (Allow 'open' accounts to bypass the date filter so they are never hidden)
        let dateFilter = `AND (a.createdAt >= '${startStr}' OR a.status = 'open')`;

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

        const account = await Account.findByPk(id, {
            include: [{ model: Order }],
            transaction: t
        });
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

        // Restore stock for all non-cancelled orders in this account before deleting
        if (account.Orders && account.Orders.length > 0) {
            const operationRoutes = require('./operation.routes');
            for (const order of account.Orders) {
                if (order.status !== 'cancelled') {
                    await operationRoutes.restoreOrderStock(order);
                }
            }
        }

        // Update payments to unlink them from the account instead of deleting them (preserve in Caja!)
        await Payment.update(
            { AccountId: null },
            { where: { AccountId: id }, transaction: t }
        );
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
        const { Account, Order, Product, Invoice } = getModels();
        const { id } = req.params;

        const account = await Account.findByPk(id, {
            include: [
                { model: Order, include: [Product] },
                { model: getModels().Payment },
                { model: getModels().Table, include: [getModels().Area] },
                { model: getModels().Invoice }
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
