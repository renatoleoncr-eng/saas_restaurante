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
        const { Payment, Account, QrAccount, BillingConfig } = require('../models');
        const { period } = req.query;

        if (!period || !/^\d{4}-\d{2}$/.test(period)) {
            return res.status(400).json({ success: false, error: 'period requerido en formato YYYY-MM' });
        }

        // Calcular rango del mes en zona horaria Lima (UTC-5)
        const [year, month] = period.split('-').map(Number);
        const startDate = new Date(Date.UTC(year, month - 1, 1, 5, 0, 0)); // 00:00 Lima = 05:00 UTC
        const endDate = new Date(Date.UTC(year, month, 1, 4, 59, 59, 999)); // Último segundo del mes en Lima

        // 1. Fetch BillingConfig and ALL active QR accounts
        const [billingConfig, qrAccounts] = await Promise.all([
            BillingConfig.findOne({ where: { TenantId: req.tenant.id } }).catch(() => null),
            QrAccount.findAll({
                where: { isActive: true, TenantId: req.tenant.id },
                attributes: ['id', 'name']
            }).catch(() => [])
        ]);

        const isExonerado = billingConfig ? billingConfig.operacionesExoneradas : false;
        const igvPercentage = isExonerado ? 0 : parseFloat(billingConfig?.igvTasa || '10.5');

        // 2. Initialize Breakdown with FIXED keys + ALL QR accounts
        // We include all QR accounts even with 0 so they appear in the Hub Config Modal
        const breakdown = {
            transfer: 0,
            card: 0,
            cash: 0,
            'QR Otros': 0
        };

        // Create mapping for IDs and pre-initialize names
        const qrAccountMap = {};
        qrAccounts.forEach(q => {
            qrAccountMap[q.id] = q.name;
            breakdown[q.name] = 0; // Pre-init to 0
        });

        // Obtener IDs de cuentas cerradas en el periodo
        const closedAccounts = await Account.findAll({
            where: {
                status: 'closed',
                closedAt: { [Op.between]: [startDate, endDate] },
                TenantId: req.tenant.id
            },
            attributes: ['id']
        });

        const accountIds = closedAccounts.map(a => a.id);

        if (accountIds.length === 0) {
            return res.json({
                success: true,
                period,
                total_real: 0,
                breakdown,
                igv_percentage: igvPercentage,
                is_exonerado: isExonerado
            });
        }

        // Obtener pagos de esas cuentas (excluyendo ajustes de QR)
        const payments = await Payment.findAll({
            where: {
                AccountId: { [Op.in]: accountIds },
                method: { [Op.ne]: 'qr_adjustment' }
            },
            include: [{
                model: QrAccount,
                as: 'QrAccount',
                attributes: ['id', 'name']
            }]
        });

        let total = 0;

        payments.forEach(p => {
            const amt = parseFloat(p.amount) || 0;
            total += amt;

            const method = (p.method || 'efectivo').toLowerCase();

            // ADVANCED MATCHING Logic
            const matchesSpecificQrName = qrAccounts.find(q =>
                method.includes(q.name.toLowerCase())
            );

            const isGenericQrMethod = method.includes('yape') || method.includes('plin') || method.includes('qr');

            if (p.qr_id && qrAccountMap[p.qr_id]) {
                // Direct association (best)
                const label = qrAccountMap[p.qr_id];
                breakdown[label] = (breakdown[label] || 0) + amt;
            } else if (p.QrAccount && p.QrAccount.name) {
                // Direct association from Eager Load
                const label = p.QrAccount.name;
                breakdown[label] = (breakdown[label] || 0) + amt;
            } else if (matchesSpecificQrName) {
                // Name match (fallback)
                const label = matchesSpecificQrName.name;
                breakdown[label] = (breakdown[label] || 0) + amt;
            } else if (isGenericQrMethod) {
                // generic QR but no specific account found
                breakdown['QR Otros'] += amt;
            } else if (method.includes('transfer') || method.includes('transf') || method.includes('transferencia')) {
                breakdown.transfer += amt;
            } else if (method.includes('card') || method.includes('tarjeta') || method.includes('pos')) {
                breakdown.card += amt;
            } else if (method.includes('cash') || method.includes('efectivo')) {
                breakdown.cash += amt;
            } else {
                // Fallback to cash if truly unknown method
                breakdown.cash += amt;
            }
        });

        // Formatting for Hub (round to 2 decimals)
        Object.keys(breakdown).forEach(k => {
            breakdown[k] = parseFloat(breakdown[k].toFixed(2));
        });

        console.log(`[Revenue] Breakdown period=${period}: total=${total}`, breakdown);

        res.json({
            success: true,
            period,
            total_real: parseFloat(total.toFixed(2)),
            breakdown,
            igv_percentage: igvPercentage,
            is_exonerado: isExonerado
        });

    } catch (error) {
        console.error('[Revenue] Error en breakdown:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

