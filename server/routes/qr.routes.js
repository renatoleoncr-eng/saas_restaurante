const express = require('express');
const router = express.Router();
const { QrAccount, Payment, User, Account, sequelize } = require('../models');
const appEmitter = require('../utils/emitter');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for QR Image Uploads
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'qr-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Helper to check if a webhook should be triggered
const shouldTrigger = (url) => {
    return url && 
           url !== 'disabled' && 
           !url.includes('localhost:5678') && 
           !url.includes('127.0.0.1:5678') &&
           url.startsWith('http');
};

// Send QR Limit notification webhook (equivalent to N8N webhook in Mak)
const sendQrLimitWebhook = async (qrData) => {
    const webhookUrl = process.env.N8N_QR_LIMIT_WEBHOOK;
    if (!shouldTrigger(webhookUrl)) {
        console.log('[Webhook] QR limit webhook disabled or missing. Skipping.');
        return;
    }
    try {
        const axios = require('axios');
        const payload = {
            id: qrData.id,
            name: qrData.name,
            limit_amount: qrData.limitAmount,
            accumulated_sum: qrData.accumulated_month_sum,
            month: qrData.accumulated_month_key,
            timestamp: new Date().toISOString()
        };
        console.log('[Webhook] Sending QR limit webhook:', payload);
        await axios.post(webhookUrl, payload, { timeout: 5000 });
    } catch (error) {
        console.error('[Webhook] Error sending QR limit webhook:', error.message);
    }
};

// HELPER FUNCTION: Sync QR monthly sum
const syncQrSum = async (qrId, transaction = null) => {
    try {
        const qr = await QrAccount.findByPk(qrId, { transaction });
        if (!qr) return;

        const now = new Date();
        const peruNow = new Date(now.getTime() - (5 * 60 * 60 * 1000));
        const monthKey = `${peruNow.getFullYear()}-${String(peruNow.getMonth() + 1).padStart(2, '0')}`;

        // Fetch all payments for this QR
        const allPayments = await Payment.findAll({
            where: { qr_id: qrId },
            transaction
        });

        // Filter payments by current month key (based on peru local time)
        const monthPayments = allPayments.filter(p => {
            const date = new Date(p.createdAt);
            const peruDate = new Date(date.getTime() - (5 * 60 * 60 * 1000));
            const tMonthKey = `${peruDate.getFullYear()}-${String(peruDate.getMonth() + 1).padStart(2, '0')}`;
            return tMonthKey === monthKey;
        });

        const income = monthPayments
            .filter(p => {
                if (p.method === 'qr_adjustment') {
                    try {
                        const data = JSON.parse(p.evidence);
                        return data.type === 'income';
                    } catch (e) {
                        return true;
                    }
                }
                return true;
            })
            .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);

        const expense = monthPayments
            .filter(p => {
                if (p.method === 'qr_adjustment') {
                    try {
                        const data = JSON.parse(p.evidence);
                        return data.type === 'expense';
                    } catch (e) {
                        return false;
                    }
                }
                return false;
            })
            .reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);

        qr.accumulated_month_sum = Math.max(0, income - expense);
        qr.accumulated_month_key = monthKey;
        await qr.save({ transaction });

        return qr;
    } catch (error) {
        console.error('Error in syncQrSum:', error);
    }
};

// HELPER FUNCTION: Consume QR limit
const consumeQrLimit = async (amount, transaction = null) => {
    try {
        const now = new Date();
        const peruNow = new Date(now.getTime() - (5 * 60 * 60 * 1000));
        const monthKey = `${peruNow.getFullYear()}-${String(peruNow.getMonth() + 1).padStart(2, '0')}`;

        const qrs = await QrAccount.findAll({
            where: { isActive: true },
            order: [['orderIndex', 'ASC'], ['id', 'ASC']],
            transaction
        });

        if (qrs.length === 0) return null;

        let selectedQr = null;

        for (const qr of qrs) {
            if (qr.accumulated_month_key !== monthKey) {
                qr.accumulated_month_sum = 0;
                qr.accumulated_month_key = monthKey;
                await qr.save({ transaction });
            }

            if (qr.isUnlimited || parseFloat(qr.accumulated_month_sum) < parseFloat(qr.limitAmount)) {
                selectedQr = qr;
                break;
            }
        }

        if (!selectedQr) return null;

        const newSum = parseFloat(selectedQr.accumulated_month_sum) + parseFloat(amount);
        selectedQr.accumulated_month_sum = newSum;
        await selectedQr.save({ transaction });

        // Trigger notifications if limit reached
        if (!selectedQr.isUnlimited && newSum >= parseFloat(selectedQr.limitAmount)) {
            sendQrLimitWebhook(selectedQr);
        }

        appEmitter.emit('qr_config_changed');

        return selectedQr.id;
    } catch (error) {
        console.error('Error in consumeQrLimit:', error);
        return null;
    }
};

// ROUTE: Get all QRs
router.get('/', async (req, res) => {
    try {
        const qrs = await QrAccount.findAll({
            order: [['orderIndex', 'ASC'], ['id', 'ASC']]
        });
        
        for (const qr of qrs) {
            await syncQrSum(qr.id);
        }

        res.json(qrs);
    } catch (error) {
        console.error('Error in getQrs:', error);
        res.status(500).json({ error: 'Error al obtener los QRs' });
    }
});

// ROUTE: Create QR
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const { name, limitAmount, isUnlimited, isActive, orderIndex, phoneNumber } = req.body;
        let imageUrl = null;
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        }
        
        const newQr = await QrAccount.create({
            name,
            limitAmount: limitAmount || 0,
            isUnlimited: isUnlimited === 'true' || isUnlimited === true,
            isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : true,
            orderIndex: orderIndex || 0,
            phoneNumber: phoneNumber || null,
            imageUrl,
            TenantId: req.tenant.id
        });

        appEmitter.emit('qr_config_changed');

        res.status(201).json(newQr);
    } catch (error) {
        console.error('Error in createQr:', error);
        res.status(500).json({ error: 'Error al crear el QR' });
    }
});

// ROUTE: Reorder QRs
router.put('/reorder', async (req, res) => {
    try {
        const { items } = req.body;
        for (const item of items) {
            await QrAccount.update({ orderIndex: item.orderIndex }, { where: { id: item.id } });
        }
        
        appEmitter.emit('qr_config_changed');

        res.json({ message: 'Orden actualizado' });
    } catch (error) {
        console.error('Error in reorderQrs:', error);
        res.status(500).json({ error: 'Error al reordenar QRs' });
    }
});

// ROUTE: Update QR
router.put('/:id', upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, limitAmount, isUnlimited, isActive, orderIndex, phoneNumber } = req.body;
        
        const qr = await QrAccount.findByPk(id);
        if (!qr) return res.status(404).json({ error: 'QR no encontrado' });

        if (name !== undefined) qr.name = name;
        if (limitAmount !== undefined) qr.limitAmount = limitAmount;
        if (isUnlimited !== undefined) qr.isUnlimited = (isUnlimited === 'true' || isUnlimited === true);
        if (isActive !== undefined) qr.isActive = (isActive === 'true' || isActive === true);
        if (orderIndex !== undefined) qr.orderIndex = orderIndex;
        if (phoneNumber !== undefined) qr.phoneNumber = phoneNumber;
        
        if (req.file) {
            if (qr.imageUrl) {
                const oldPath = path.join(__dirname, '..', qr.imageUrl);
                if (fs.existsSync(oldPath)) {
                    try { fs.unlinkSync(oldPath); } catch (e) {}
                }
            }
            qr.imageUrl = `/uploads/${req.file.filename}`;
        }

        await qr.save();
        
        if (!qr.isUnlimited && parseFloat(qr.accumulated_month_sum) >= parseFloat(qr.limitAmount)) {
            sendQrLimitWebhook(qr);
        }

        appEmitter.emit('qr_config_changed');
        appEmitter.emit('check_active_qr');

        res.json(qr);
    } catch (error) {
        console.error('Error in updateQr:', error);
        res.status(500).json({ error: 'Error al actualizar el QR' });
    }
});

// ROUTE: Delete QR
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const qr = await QrAccount.findByPk(id);
        if (!qr) return res.status(404).json({ error: 'QR no encontrado' });

        if (qr.imageUrl) {
            const oldPath = path.join(__dirname, '..', qr.imageUrl);
            if (fs.existsSync(oldPath)) {
                try { fs.unlinkSync(oldPath); } catch (e) {}
            }
        }

        await qr.destroy();
        
        appEmitter.emit('qr_config_changed');

        res.json({ message: 'QR eliminado correctamente' });
    } catch (error) {
        console.error('Error in deleteQr:', error);
        res.status(500).json({ error: 'Error al eliminar el QR' });
    }
});

// ROUTE: Get active QR
router.get('/active', async (req, res) => {
    try {
        const now = new Date();
        const peruNow = new Date(now.getTime() - (5 * 60 * 60 * 1000));
        const monthKey = `${peruNow.getFullYear()}-${String(peruNow.getMonth() + 1).padStart(2, '0')}`;

        const qrs = await QrAccount.findAll({
            where: { isActive: true },
            order: [['orderIndex', 'ASC'], ['id', 'ASC']]
        });
        
        if (qrs.length === 0) {
            return res.json({ message: 'No hay QRs activos', activeQr: null });
        }

        let activeQr = null;
        let exhausted = true;

        for (const qr of qrs) {
            if (qr.accumulated_month_key !== monthKey) {
                qr.accumulated_month_sum = 0;
                qr.accumulated_month_key = monthKey;
                await qr.save();
            }

            if (qr.isUnlimited || parseFloat(qr.accumulated_month_sum) < parseFloat(qr.limitAmount)) {
                activeQr = qr;
                exhausted = false;
                break;
            }
        }

        if (exhausted) {
            return res.json({ activeQr: null, message: 'Todos los QRs han alcanzado su límite transaccional mensual.' });
        }

        const responseData = {
            activeQr: {
                ...activeQr.toJSON(),
                isUnlimited: !!activeQr.isUnlimited,
                isActive: !!activeQr.isActive
            },
            message: activeQr.isUnlimited ? 'Ilimitado' : 'Capacidad disponible',
            remainingCapacity: activeQr.isUnlimited ? null : (parseFloat(activeQr.limitAmount) - parseFloat(activeQr.accumulated_month_sum))
        };

        return res.json(responseData);
    } catch (error) {
        console.error('Error in getActiveQr:', error);
        res.status(500).json({ error: 'Error al obtener el QR activo' });
    }
});

// ROUTE: Reset sums manually
router.post('/reset', async (req, res) => {
    try {
        await QrAccount.update({ accumulated_month_sum: 0 }, { where: {} });
        
        // Delete qr adjustments and notify config change
        await Payment.destroy({ where: { method: 'qr_adjustment' } });

        appEmitter.emit('qr_config_changed');
        appEmitter.emit('check_active_qr');

        res.json({ message: 'Montos de QR reiniciados y ajustes de prueba eliminados' });
    } catch (error) {
        console.error('Error in resetSums:', error);
        res.status(500).json({ error: 'Error al reiniciar los montos' });
    }
});

// ROUTE: Adjust QR sum manually
router.post('/:id/adjust', async (req, res) => {
    try {
        const { id } = req.params;
        const { adjustment, description } = req.body;
        
        const qr = await QrAccount.findByPk(id);
        if (!qr) return res.status(404).json({ error: 'QR no encontrado' });

        const now = new Date();
        const peruNow = new Date(now.getTime() - (5 * 60 * 60 * 1000));
        const monthKey = `${peruNow.getFullYear()}-${String(peruNow.getMonth() + 1).padStart(2, '0')}`;
        
        if (qr.accumulated_month_key !== monthKey) {
            qr.accumulated_month_sum = 0;
            qr.accumulated_month_key = monthKey;
        }

        const adjustmentValue = parseFloat(adjustment || 0);
        let newSum = parseFloat(qr.accumulated_month_sum) + adjustmentValue;
        if (newSum < 0) newSum = 0;

        qr.accumulated_month_sum = newSum;
        await qr.save();

        if (adjustmentValue !== 0) {
            // Generate payment record for audit
            await Payment.create({
                qr_id: qr.id,
                amount: Math.abs(adjustmentValue),
                method: 'qr_adjustment',
                evidence: JSON.stringify({
                    type: adjustmentValue > 0 ? 'income' : 'expense',
                    description: description || `Ajuste manual de saldo - ${qr.name}`
                }),
                TenantId: req.tenant.id,
                UserId: req.body.userId || null
            });
        }

        appEmitter.emit('qr_config_changed');
        appEmitter.emit('check_active_qr');

        if (!qr.isUnlimited && parseFloat(qr.accumulated_month_sum) >= parseFloat(qr.limitAmount)) {
            sendQrLimitWebhook(qr);
        }

        res.json({ message: 'Monto ajustado correctamente', qr });
    } catch (error) {
        console.error('Error in adjustQrSum:', error);
        res.status(500).json({ error: 'Error al ajustar el monto' });
    }
});

// ROUTE: Get QR Movements/History
router.get('/movements', async (req, res) => {
    try {
        const { month, qr_id, user_id, transaction_type } = req.query;
        let conditions = [];

        // 1. Base criteria: include yape/plin payments or manual adjustments or explicitly assigned qr_id
        const qrBaseCriteria = {
            [Op.or]: [
                { method: 'qr_adjustment' },
                { method: 'yape' },
                { method: 'plin' },
                { method: { [Op.like]: '%yape%' } },
                { method: { [Op.like]: '%plin%' } },
                { qr_id: { [Op.ne]: null } }
            ]
        };
        conditions.push(qrBaseCriteria);

        // 2. Filter by month
        if (month && month !== 'all' && month !== '') {
            const isSqlite = sequelize.options.dialect === 'sqlite';
            if (isSqlite) {
                conditions.push(
                    sequelize.where(
                        sequelize.fn('strftime', '%Y-%m', 
                            sequelize.fn('datetime', sequelize.col('Payment.createdAt'), '-5 hours')
                        ),
                        month
                    )
                );
            } else {
                conditions.push(
                    sequelize.where(
                        sequelize.fn('DATE_FORMAT', 
                            sequelize.fn('DATE_SUB', sequelize.col('Payment.createdAt'), sequelize.literal('INTERVAL 5 HOUR')), 
                            '%Y-%m'
                        ),
                        month
                    )
                );
            }
        }

        // 3. UI Filters
        if (qr_id && qr_id !== 'all' && qr_id !== '') {
            conditions.push({ qr_id });
        }
        if (user_id && user_id !== 'all' && user_id !== '') {
            conditions.push({ UserId: user_id });
        }

        // 4. Concept filter
        const concept = transaction_type || 'all';
        if (concept !== 'all') {
            if (concept === 'qr_adjustment') {
                conditions.push({ method: 'qr_adjustment' });
            } else {
                conditions.push({ 
                    [Op.or]: [
                        { method: { [Op.like]: `%${concept}%` } },
                        { evidence: { [Op.like]: `%${concept}%` } }
                    ]
                });
            }
        }

        const movements = await Payment.findAll({
            where: { [Op.and]: conditions },
            include: [
                { model: User, attributes: ['id', 'displayName', 'role'] },
                { model: QrAccount, as: 'QrAccount', attributes: ['id', 'name'] },
                { model: Account, attributes: ['id', 'customerName'] }
            ],
            order: [['createdAt', 'DESC'], ['id', 'DESC']]
        });

        res.json(movements);
    } catch (error) {
        console.error('Error in getQrMovements:', error);
        res.status(500).json({ error: 'Error al obtener los movimientos del QR' });
    }
});

module.exports = router;
module.exports.consumeQrLimit = consumeQrLimit;
module.exports.syncQrSum = syncQrSum;
