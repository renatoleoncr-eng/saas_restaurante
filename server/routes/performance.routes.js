const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const sequelize = require('../config/db');
const {
    Payment, Account, Expense, Table, Area,
    Order, Product, User
} = require('../models');
const { requireRole } = require('../middleware/auth.middleware');

// Helper para obtener nombre abreviado del día de la semana
const getDayLabel = (dateObj) => {
    try {
        const labels = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
        return labels[dateObj.getDay()];
    } catch (_) {
        return '?';
    }
};

/**
 * GET /api/performance/stats
 * Parámetros query:
 *   - year (opcional, default año actual)
 *   - month (opcional, 1-12, default mes actual)
 *   - startDay (opcional, 1..31, default 1)
 *   - endDay (opcional, 1..31, default fin del mes)
 * Restringido: Solo rol 'admin'
 */
router.get('/performance/stats', requireRole('admin'), async (req, res) => {
    try {
        const tenantId = req.tenant?.id;
        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID requerido' });
        }

        const now = new Date();
        const selectedYear = parseInt(req.query.year, 10) || now.getFullYear();
        const selectedMonth = parseInt(req.query.month, 10) || (now.getMonth() + 1); // 1-12
        const daysInSelectedMonth = new Date(selectedYear, selectedMonth, 0).getDate();

        const sDay = Math.max(1, Math.min(parseInt(req.query.startDay, 10) || 1, daysInSelectedMonth));
        const eDay = Math.max(sDay, Math.min(parseInt(req.query.endDay, 10) || daysInSelectedMonth, daysInSelectedMonth));

        const isMySQL = sequelize.getDialect() === 'mysql';

        // Constantes del día operativo gastronómico
        // 07:00 AM hora Perú (UTC-5) = 12:00:00 UTC
        const PERU_TIMEZONE_OFFSET_HOURS = 5;
        const OPERATION_CUTOFF_HOURS = 7;
        const TOTAL_OFFSET_HOURS = PERU_TIMEZONE_OFFSET_HOURS + OPERATION_CUTOFF_HOURS; // 12h

        // Generador de rangos UTC considerando el corte a las 07:00 AM Perú
        const getRange = (y, m, dStart, dEnd) => {
            const maxDays = new Date(y, m, 0).getDate();
            const startDayVal = Math.max(1, Math.min(dStart, maxDays));
            const endDayVal = Math.max(startDayVal, Math.min(dEnd, maxDays));

            const start = new Date(Date.UTC(y, m - 1, startDayVal, TOTAL_OFFSET_HOURS, 0, 0, 0));
            const end = new Date(Date.UTC(y, m - 1, endDayVal + 1, TOTAL_OFFSET_HOURS - 1, 59, 59, 999));
            return { start, end };
        };

        const currentRange = getRange(selectedYear, selectedMonth, sDay, eDay);
        const fullMonthRange = getRange(selectedYear, selectedMonth, 1, daysInSelectedMonth);
        const yearlyRange = {
            start: new Date(Date.UTC(selectedYear, 0, 1, TOTAL_OFFSET_HOURS, 0, 0, 0)),
            end: new Date(Date.UTC(selectedYear + 1, 0, 1, TOTAL_OFFSET_HOURS - 1, 59, 59, 999))
        };

        // Mes anterior para la comparativa diaria
        const prevMonthYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
        const prevMonthNum = selectedMonth === 1 ? 12 : selectedMonth - 1;
        const daysInPrevMonth = new Date(prevMonthYear, prevMonthNum, 0).getDate();
        const prevMonthRange = getRange(prevMonthYear, prevMonthNum, 1, daysInPrevMonth);

        // Helper para expresiones de fecha según dialecto
        const getMonthExpr = (colName) => {
            return isMySQL
                ? sequelize.fn('MONTH', sequelize.fn('DATE_SUB', sequelize.col(colName), sequelize.literal(`INTERVAL ${TOTAL_OFFSET_HOURS} HOUR`)))
                : sequelize.fn('strftime', '%m', sequelize.fn('datetime', sequelize.col(colName), `-${TOTAL_OFFSET_HOURS} hours`));
        };

        const getDayExpr = (colName) => {
            return isMySQL
                ? sequelize.fn('DAY', sequelize.fn('DATE_SUB', sequelize.col(colName), sequelize.literal(`INTERVAL ${TOTAL_OFFSET_HOURS} HOUR`)))
                : sequelize.fn('strftime', '%d', sequelize.fn('datetime', sequelize.col(colName), `-${TOTAL_OFFSET_HOURS} hours`));
        };

        // 0. Años disponibles (desde el primer pago o cuenta)
        const [firstPayment, firstAccount] = await Promise.all([
            Payment.findOne({
                where: { TenantId: tenantId },
                order: [['createdAt', 'ASC']],
                attributes: ['createdAt']
            }),
            Account.findOne({
                where: { TenantId: tenantId },
                order: [['createdAt', 'ASC']],
                attributes: ['createdAt']
            })
        ]);

        const oldestDate = firstPayment?.createdAt || firstAccount?.createdAt || now;
        const startYear = Math.min(new Date(oldestDate).getFullYear(), now.getFullYear());
        const availableYears = [];
        for (let y = now.getFullYear(); y >= Math.max(startYear, 2024); y--) {
            availableYears.push(y);
        }
        if (!availableYears.includes(selectedYear)) {
            availableYears.push(selectedYear);
            availableYears.sort((a, b) => b - a);
        }

        // 1. Capacidad de mesas del restaurante
        const totalTables = await Table.count({ where: { TenantId: tenantId } }) || 0;

        // 2. KPIs del periodo seleccionado (sDay..eDay)
        const [paymentKpi, accountKpi, expenseKpi] = await Promise.all([
            Payment.findOne({
                attributes: [
                    [sequelize.fn('SUM', sequelize.col('amount')), 'totalIncome'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'totalPayments']
                ],
                where: {
                    TenantId: tenantId,
                    method: { [Op.ne]: 'qr_adjustment' },
                    createdAt: { [Op.between]: [currentRange.start, currentRange.end] }
                },
                raw: true
            }),
            Account.findOne({
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'totalAccounts'],
                    [sequelize.fn('SUM', sequelize.col('total')), 'sumAccounts']
                ],
                where: {
                    TenantId: tenantId,
                    status: 'closed',
                    closedAt: { [Op.between]: [currentRange.start, currentRange.end] }
                },
                raw: true
            }),
            Expense.findOne({
                attributes: [
                    [sequelize.fn('SUM', sequelize.col('amount')), 'totalExpenses']
                ],
                where: {
                    TenantId: tenantId,
                    date: { [Op.between]: [currentRange.start, currentRange.end] }
                },
                raw: true
            })
        ]);

        const totalIncome = parseFloat(paymentKpi?.totalIncome || 0);
        const totalAccounts = parseInt(accountKpi?.totalAccounts || 0, 10);
        const totalExpenses = parseFloat(expenseKpi?.totalExpenses || 0);
        const avgTicket = totalAccounts > 0 ? Number((totalIncome / totalAccounts).toFixed(2)) : 0;
        const rentabilidad = Number((totalIncome - totalExpenses).toFixed(2));

        // 3. Ocupación de mesas del periodo seleccionado (días sDay..eDay)
        // Obtenemos cuentas activas por día agrupadas por día operativo y TableId
        const activeAccountsByDay = await Account.findAll({
            attributes: [
                [getDayExpr('closedAt'), 'stat_day'],
                'TableId'
            ],
            where: {
                TenantId: tenantId,
                status: 'closed',
                TableId: { [Op.ne]: null },
                closedAt: { [Op.between]: [currentRange.start, currentRange.end] }
            },
            group: ['stat_day', 'TableId'],
            raw: true
        });

        // Contar mesas únicas ocupadas por día
        const uniqueTablesPerDay = {};
        activeAccountsByDay.forEach(r => {
            const dayNum = parseInt(r.stat_day, 10);
            if (!uniqueTablesPerDay[dayNum]) uniqueTablesPerDay[dayNum] = new Set();
            if (r.TableId) uniqueTablesPerDay[dayNum].add(r.TableId);
        });

        const evaluatedDaysCount = (eDay - sDay + 1);
        let sumDailyOccupancyRates = 0;
        for (let d = sDay; d <= eDay; d++) {
            const tablesUsed = uniqueTablesPerDay[d] ? uniqueTablesPerDay[d].size : 0;
            const dailyRate = totalTables > 0 ? (tablesUsed / totalTables) * 100 : 0;
            sumDailyOccupancyRates += dailyRate;
        }
        const occupancyRate = evaluatedDaysCount > 0 ? Number((sumDailyOccupancyRates / evaluatedDaysCount).toFixed(1)) : 0;

        // 4. Evolutivo Mensual (Ene - Dic) del año seleccionado
        const [yearlyIncomeRaw, yearlyExpensesRaw, yearlyAccountsRaw, yearlyOccupancyRaw] = await Promise.all([
            Payment.findAll({
                attributes: [
                    [getMonthExpr('createdAt'), 'stat_month'],
                    [sequelize.fn('SUM', sequelize.col('amount')), 'total']
                ],
                where: {
                    TenantId: tenantId,
                    method: { [Op.ne]: 'qr_adjustment' },
                    createdAt: { [Op.between]: [yearlyRange.start, yearlyRange.end] }
                },
                group: ['stat_month'],
                raw: true
            }),
            Expense.findAll({
                attributes: [
                    [getMonthExpr('date'), 'stat_month'],
                    [sequelize.fn('SUM', sequelize.col('amount')), 'total']
                ],
                where: {
                    TenantId: tenantId,
                    date: { [Op.between]: [yearlyRange.start, yearlyRange.end] }
                },
                group: ['stat_month'],
                raw: true
            }),
            Account.findAll({
                attributes: [
                    [getMonthExpr('closedAt'), 'stat_month'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'total']
                ],
                where: {
                    TenantId: tenantId,
                    status: 'closed',
                    closedAt: { [Op.between]: [yearlyRange.start, yearlyRange.end] }
                },
                group: ['stat_month'],
                raw: true
            }),
            Account.findAll({
                attributes: [
                    [getMonthExpr('closedAt'), 'stat_month'],
                    [getDayExpr('closedAt'), 'stat_day'],
                    'TableId'
                ],
                where: {
                    TenantId: tenantId,
                    status: 'closed',
                    TableId: { [Op.ne]: null },
                    closedAt: { [Op.between]: [yearlyRange.start, yearlyRange.end] }
                },
                group: ['stat_month', 'stat_day', 'TableId'],
                raw: true
            })
        ]);

        // Construir ocupación mensual para los 12 meses
        const monthlyOccupancyMap = {};
        yearlyOccupancyRaw.forEach(r => {
            const m = parseInt(r.stat_month, 10);
            const d = parseInt(r.stat_day, 10);
            if (!monthlyOccupancyMap[m]) monthlyOccupancyMap[m] = {};
            if (!monthlyOccupancyMap[m][d]) monthlyOccupancyMap[m][d] = new Set();
            if (r.TableId) monthlyOccupancyMap[m][d].add(r.TableId);
        });

        const monthsNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        const evolution = monthsNames.map((name, idx) => {
            const mNum = idx + 1;
            const mStr = mNum.toString().padStart(2, '0');
            const inc = yearlyIncomeRaw.find(r => parseInt(r.stat_month, 10) === mNum);
            const exp = yearlyExpensesRaw.find(r => parseInt(r.stat_month, 10) === mNum);
            const acc = yearlyAccountsRaw.find(r => parseInt(r.stat_month, 10) === mNum);

            // Calcular ocupación del mes
            const daysInM = new Date(selectedYear, mNum, 0).getDate();
            let sumRates = 0;
            const daysMap = monthlyOccupancyMap[mNum] || {};
            for (let d = 1; d <= daysInM; d++) {
                const tablesCount = daysMap[d] ? daysMap[d].size : 0;
                sumRates += totalTables > 0 ? (tablesCount / totalTables) * 100 : 0;
            }
            const monthOccRate = daysInM > 0 ? Number((sumRates / daysInM).toFixed(1)) : 0;

            return {
                stat_month: mStr,
                name: name.substring(0, 3),
                fullName: name,
                ingresos: parseFloat(inc?.total || 0),
                gastos: parseFloat(exp?.total || 0),
                cuentas: parseInt(acc?.total || 0, 10),
                ocupacion: monthOccRate
            };
        });

        // 5. Comparativo Diario (Mes Seleccionado vs Mes Anterior)
        const [currentDailyRaw, prevDailyRaw] = await Promise.all([
            Payment.findAll({
                attributes: [
                    [getDayExpr('createdAt'), 'stat_day'],
                    [sequelize.fn('SUM', sequelize.col('amount')), 'total']
                ],
                where: {
                    TenantId: tenantId,
                    method: { [Op.ne]: 'qr_adjustment' },
                    createdAt: { [Op.between]: [fullMonthRange.start, fullMonthRange.end] }
                },
                group: ['stat_day'],
                raw: true
            }),
            Payment.findAll({
                attributes: [
                    [getDayExpr('createdAt'), 'stat_day'],
                    [sequelize.fn('SUM', sequelize.col('amount')), 'total']
                ],
                where: {
                    TenantId: tenantId,
                    method: { [Op.ne]: 'qr_adjustment' },
                    createdAt: { [Op.between]: [prevMonthRange.start, prevMonthRange.end] }
                },
                group: ['stat_day'],
                raw: true
            })
        ]);

        const dailyComparison = [];
        for (let d = 1; d <= daysInSelectedMonth; d++) {
            const dateObj = new Date(selectedYear, selectedMonth - 1, d);
            const curr = currentDailyRaw.find(r => parseInt(r.stat_day, 10) === d);
            const prev = prevDailyRaw.find(r => parseInt(r.stat_day, 10) === d);

            dailyComparison.push({
                day: d,
                label: getDayLabel(dateObj),
                current: parseFloat(curr?.total || 0),
                previous: parseFloat(prev?.total || 0)
            });
        }

        // 6. Volumen Diario (Cuentas y Mesas atendidas dentro del rango sDay..eDay)
        const accountsDailyRaw = await Account.findAll({
            attributes: [
                [getDayExpr('closedAt'), 'stat_day'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'total_accounts']
            ],
            where: {
                TenantId: tenantId,
                status: 'closed',
                closedAt: { [Op.between]: [currentRange.start, currentRange.end] }
            },
            group: ['stat_day'],
            raw: true
        });

        const dailyVolumeData = [];
        for (let d = sDay; d <= eDay; d++) {
            const acc = accountsDailyRaw.find(r => parseInt(r.stat_day, 10) === d);
            const tablesUsed = uniqueTablesPerDay[d] ? uniqueTablesPerDay[d].size : 0;
            dailyVolumeData.push({
                day: d,
                cuentas: parseInt(acc?.total_accounts || 0, 10),
                mesas: tablesUsed
            });
        }

        // 7. Preferencia de Mesas (Top Tables más solicitadas)
        const topTablesRaw = await Account.findAll({
            attributes: [
                'TableId',
                [sequelize.fn('COUNT', sequelize.col('Account.id')), 'account_count'],
                [sequelize.fn('SUM', sequelize.col('total')), 'total_amount']
            ],
            where: {
                TenantId: tenantId,
                status: 'closed',
                TableId: { [Op.ne]: null },
                closedAt: { [Op.between]: [currentRange.start, currentRange.end] }
            },
            include: [{
                model: Table,
                paranoid: false,
                attributes: ['id', 'number'],
                include: [{
                    model: Area,
                    attributes: ['id', 'name']
                }]
            }],
            group: ['TableId', 'Table.id', 'Table.number', 'Table.Area.id', 'Table.Area.name'],
            raw: true,
            nest: true
        });

        const topTables = topTablesRaw
            .map(r => ({
                tableId: r.TableId,
                tableNumber: r.Table?.number || `Mesa ${r.TableId}`,
                areaName: r.Table?.Area?.name || 'Salón',
                count: parseInt(r.account_count || 0, 10),
                total: parseFloat(r.total_amount || 0)
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // 8. Distribución de Ventas (Top Productos más vendidos)
        const topProductsRaw = await Order.findAll({
            attributes: [
                'ProductId',
                [sequelize.fn('SUM', sequelize.col('quantity')), 'quantity'],
                [sequelize.fn('SUM', sequelize.literal('quantity * COALESCE(priceAtOrder, 0)')), 'total']
            ],
            where: {
                TenantId: tenantId,
                status: { [Op.ne]: 'cancelled' },
                createdAt: { [Op.between]: [currentRange.start, currentRange.end] }
            },
            include: [{
                model: Product,
                paranoid: false,
                attributes: ['id', 'name', 'category', 'type']
            }],
            group: ['ProductId', 'Product.id', 'Product.name', 'Product.category', 'Product.type'],
            raw: true,
            nest: true
        });

        const topProducts = topProductsRaw
            .map(r => ({
                productId: r.ProductId,
                name: r.Product?.name || `Producto #${r.ProductId}`,
                category: r.Product?.category || r.Product?.type || 'General',
                quantity: parseInt(r.quantity || 0, 10),
                total: parseFloat(r.total || 0)
            }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);

        // 9. Distribución de Ingresos por Método de Pago
        const paymentMethodsRaw = await Payment.findAll({
            attributes: [
                'method',
                [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            where: {
                TenantId: tenantId,
                method: { [Op.ne]: 'qr_adjustment' },
                createdAt: { [Op.between]: [currentRange.start, currentRange.end] }
            },
            group: ['method'],
            raw: true
        });

        const paymentMethods = paymentMethodsRaw.map(p => {
            const m = (p.method || 'efectivo').toLowerCase();
            let label = 'Efectivo';
            if (m.includes('yape') || m.includes('plin') || m.includes('qr')) label = 'Yape / Plin';
            else if (m.includes('tarjeta') || m.includes('card')) label = 'Tarjeta';
            else if (m.includes('transferencia') || m.includes('transfer')) label = 'Transferencia';

            return {
                method: label,
                rawMethod: p.method,
                total: parseFloat(p.total || 0),
                count: parseInt(p.count || 0, 10)
            };
        });

        // 10. Ranking de Productividad por Usuario
        // 10a. Mozos / Staff por órdenes tomadas
        const userOrdersRaw = await Order.findAll({
            attributes: [
                'UserId',
                [sequelize.fn('COUNT', sequelize.col('Order.id')), 'order_count'],
                [sequelize.fn('SUM', sequelize.literal('quantity * COALESCE(priceAtOrder, 0)')), 'total_sales']
            ],
            where: {
                TenantId: tenantId,
                status: { [Op.ne]: 'cancelled' },
                UserId: { [Op.ne]: null },
                createdAt: { [Op.between]: [currentRange.start, currentRange.end] }
            },
            include: [{
                model: User,
                attributes: ['id', 'displayName', 'username', 'role']
            }],
            group: ['UserId', 'User.id', 'User.displayName', 'User.username', 'User.role'],
            raw: true,
            nest: true
        });

        const productivityByOrders = userOrdersRaw
            .map(r => ({
                userId: r.UserId,
                name: r.User?.displayName || r.User?.username || 'Staff',
                role: r.User?.role || 'waiter',
                ordersCount: parseInt(r.order_count || 0, 10),
                total: parseFloat(r.total_sales || 0)
            }))
            .sort((a, b) => b.total - a.total);

        // 10b. Cajeros / Staff por cobros procesados
        const userPaymentsRaw = await Payment.findAll({
            attributes: [
                'UserId',
                [sequelize.fn('COUNT', sequelize.col('Payment.id')), 'payment_count'],
                [sequelize.fn('SUM', sequelize.col('amount')), 'total_collected']
            ],
            where: {
                TenantId: tenantId,
                method: { [Op.ne]: 'qr_adjustment' },
                UserId: { [Op.ne]: null },
                createdAt: { [Op.between]: [currentRange.start, currentRange.end] }
            },
            include: [{
                model: User,
                attributes: ['id', 'displayName', 'username', 'role']
            }],
            group: ['UserId', 'User.id', 'User.displayName', 'User.username', 'User.role'],
            raw: true,
            nest: true
        });

        const productivityByPayments = userPaymentsRaw
            .map(r => ({
                userId: r.UserId,
                name: r.User?.displayName || r.User?.username || 'Staff',
                role: r.User?.role || 'cashier',
                paymentCount: parseInt(r.payment_count || 0, 10),
                total: parseFloat(r.total_collected || 0)
            }))
            .sort((a, b) => b.total - a.total);

        // Respuesta consolidada
        res.json({
            success: true,
            filter: {
                year: selectedYear,
                month: selectedMonth,
                startDay: sDay,
                endDay: eDay,
                totalTables
            },
            availableYears,
            kpis: {
                ingresos: totalIncome,
                occupancyRate,
                avgTicket,
                totalAccounts,
                totalExpenses,
                rentabilidad
            },
            evolution,
            dailyComparison,
            dailyVolumeData,
            topTables,
            topProducts,
            paymentMethods,
            userProductivity: {
                byOrders: productivityByOrders,
                byPayments: productivityByPayments
            }
        });

    } catch (err) {
        console.error('Error in /api/performance/stats:', err);
        res.status(500).json({
            error: 'Error al generar estadísticas de rendimiento',
            details: err.message
        });
    }
});

module.exports = router;
