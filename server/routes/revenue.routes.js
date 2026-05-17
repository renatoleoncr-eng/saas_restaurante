const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');

// Middleware: validar x-api-key (mismo key que usa el Sunat Hub)
const apiKeyAuth = (req, res, next) => {
    const key = req.headers['x-api-key'];
    const expected = process.env.SAAS_API_KEY || 'mak_secure_auth_k3y_928374';
    if (!key || key !== expected) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// GET /api/revenue/breakdown?period=YYYY-MM
// Llamado por FiscalService del Sunat Hub para obtener ingresos reales
router.get('/revenue/breakdown', apiKeyAuth, async (req, res) => {
    try {
        const { Payment, Account } = require('../models');
        const { period } = req.query;

        if (!period || !/^\d{4}-\d{2}$/.test(period)) {
            return res.status(400).json({ error: 'period requerido en formato YYYY-MM' });
        }

        // Calcular rango del mes en zona horaria Lima (UTC-5)
        const [year, month] = period.split('-').map(Number);
        const startDate = new Date(Date.UTC(year, month - 1, 1, 5, 0, 0)); // 00:00 Lima = 05:00 UTC
        const endDate = new Date(Date.UTC(year, month, 1, 4, 59, 59, 999)); // Último segundo del mes en Lima

        // Obtener IDs de cuentas cerradas en el periodo
        const closedAccounts = await Account.findAll({
            where: {
                status: 'closed',
                closedAt: { [Op.between]: [startDate, endDate] }
            },
            attributes: ['id']
        });

        const accountIds = closedAccounts.map(a => a.id);

        if (accountIds.length === 0) {
            return res.json({
                period,
                breakdown: { efectivo: 0, tarjeta: 0, yape: 0, transferencia: 0 },
                total_revenue: 0
            });
        }

        // Obtener pagos de esas cuentas, agrupados por método
        const payments = await Payment.findAll({
            where: { AccountId: { [Op.in]: accountIds } },
            attributes: ['method', 'amount']
        });

        // Acumular por tipo de pago
        const breakdown = { efectivo: 0, tarjeta: 0, yape: 0, transferencia: 0 };
        payments.forEach(p => {
            const method = (p.method || 'efectivo').toLowerCase();
            if (breakdown[method] !== undefined) {
                breakdown[method] += parseFloat(p.amount || 0);
            } else {
                // Método desconocido → acumular en efectivo como fallback
                breakdown['efectivo'] += parseFloat(p.amount || 0);
            }
        });

        // Redondear a 2 decimales
        Object.keys(breakdown).forEach(k => {
            breakdown[k] = parseFloat(breakdown[k].toFixed(2));
        });

        const total_revenue = parseFloat(
            Object.values(breakdown).reduce((sum, v) => sum + v, 0).toFixed(2)
        );

        console.log(`[Revenue] Breakdown period=${period}: total=${total_revenue}`, breakdown);

        res.json({ period, breakdown, total_revenue });

    } catch (error) {
        console.error('[Revenue] Error en breakdown:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
