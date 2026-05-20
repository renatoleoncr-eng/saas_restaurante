const express = require('express');
const router = express.Router();
const axios = require('axios');
const { BillingConfig, Invoice, User } = require('../models');
const { Op } = require('sequelize');

const SUNAT_HUB_URL = process.env.SUNAT_HUB_URL || 'https://sunat.maksuites.com.pe';

// Convert number to Peruvian text (simple version)
function numToText(n) {
    const fn = parseFloat(n).toFixed(2);
    const [whole, cents] = fn.split('.');
    return `${whole} CON ${cents}/100 SOLES`;
}

// GET /billing/config
router.get('/billing/config', async (req, res) => {
    try {
        let config = await BillingConfig.findOne();
        if (!config) {
            config = {
                ruc: '',
                razonSocial: '',
                direccion: '',
                facturacionElectronica: false,
                igvTasa: 10.5,
                operacionesExoneradas: false,
                serieFactura: 'F001',
                serieBoleta: 'B001',
                apiToken: ''
            };
        }
        res.json(config);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /billing/config
router.put('/billing/config', async (req, res) => {
    try {
        const fields = ['ruc', 'razonSocial', 'direccion', 'facturacionElectronica', 'igvTasa', 'operacionesExoneradas', 'serieFactura', 'serieBoleta', 'apiToken'];
        const data = {};
        fields.forEach(f => {
            if (req.body[f] !== undefined) data[f] = req.body[f];
        });

        let config = await BillingConfig.findOne();
        if (config) {
            await config.update(data);
        } else {
            config = await BillingConfig.create(data);
        }
        res.json({ success: true, config });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /billing/consulta?doc=XXXXXXXX (Proxy to apis.net.pe)
router.get('/billing/consulta', async (req, res) => {
    const { doc } = req.query;
    if (!doc) return res.status(400).json({ error: 'doc requerido' });
    
    try {
        const isRuc = doc.length === 11;
        const type = isRuc ? 'ruc' : 'dni';
        
        // Using apis.net.pe free v1 API (consistent with Gestion Mak)
        const response = await axios.get(`https://api.apis.net.pe/v1/${type}?numero=${doc}`);
        
        if (isRuc) {
            res.json({
                razon_social: response.data.nombre,
                direccion: response.data.direccion || '',
                ...response.data
            });
        } else {
            res.json(response.data); // nombres, apellidoPaterno, etc
        }
    } catch (err) {
        const status = err.response?.status || 500;
        res.status(status).json({ 
            error: err.response?.data?.message || 'No se encontró información para este documento' 
        });
    }
});

// GET /billing/invoices
router.get('/billing/invoices', async (req, res) => {
    try {
        const where = {};
        if (req.query.documento) where.clienteDocumento = { [Op.like]: `%${req.query.documento}%` };
        if (req.query.desde || req.query.hasta) {
            where.emitidoAt = {};
            if (req.query.desde) where.emitidoAt[Op.gte] = new Date(req.query.desde + 'T00:00:00');
            if (req.query.hasta) where.emitidoAt[Op.lte] = new Date(req.query.hasta + 'T23:59:59');
        }

        const invoices = await Invoice.findAll({
            where,
            include: [{ model: User, attributes: ['id', 'username'] }],
            order: [['emitidoAt', 'DESC']],
            limit: 200
        });
        res.json(invoices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /billing/invoices (Emitir via Hub)
router.post('/billing/invoices', async (req, res) => {
    try {
        const config = await BillingConfig.findOne();
        if (!config) return res.status(400).json({ error: 'Configuración no encontrada' });

        const { tipo, clienteDocumento, clienteNombre, clienteDireccion, items, userId } = req.body;
        if (!tipo || !items?.length) return res.status(400).json({ error: 'tipo e items son requeridos' });

        const isExonerado = config.operacionesExoneradas;
        const afeCode = isExonerado ? '20' : '10';
        const igvRate = parseFloat(config.igvTasa) / 100;

        // Correlativo auto-incremental por serie
        const serie = tipo === 'factura' ? config.serieFactura : config.serieBoleta;
        const lastInvoice = await Invoice.findOne({
            where: { tipo, serie },
            order: [['correlativo', 'DESC']]
        });
        const correlativo = (lastInvoice?.correlativo || 0) + 1;

        // Desglose SUNAT (Lógica Gestion Mak)
        let total_base = 0;
        let total_igv = 0;

        const hubItems = items.map((item, i) => {
            const lineTotal = parseFloat(item.amount || item.subtotal || 0);
            const qty = parseInt(item.quantity || item.qty || 1);
            const unitTotal = lineTotal / qty;

            const unitBase = isExonerado ? unitTotal : parseFloat((unitTotal / (1 + igvRate)).toFixed(6));
            const unitPrecio = isExonerado ? unitTotal : parseFloat((unitBase * (1 + igvRate)).toFixed(6));
            const lineBase = parseFloat((unitBase * qty).toFixed(6));
            const lineIgv = isExonerado ? 0 : parseFloat((lineBase * igvRate).toFixed(6));

            total_base += lineBase;
            total_igv += lineIgv;

            return {
                code: `P${String(i + 1).padStart(3, '0')}`,
                description: item.description,
                qty: qty,
                valor_unitario: unitBase,
                precio_unitario: unitPrecio,
                valor_venta: lineBase,
                porcentaje_igv: isExonerado ? 0 : (igvRate * 100),
                igv: parseFloat(lineIgv.toFixed(2)),
                monto_base_igv: parseFloat(lineBase.toFixed(2)),
                tipo_afe_igv: afeCode,
                codigo_tipo_tributo: isExonerado ? '9997' : '1000',
                nombre_tributo: isExonerado ? 'EXO' : 'IGV',
                codigo_tipo_internacional_tributo: 'VAT'
            };
        });

        const finalTotalIgv = isExonerado ? 0 : parseFloat(total_igv.toFixed(2));
        const finalTotalPay = parseFloat(items.reduce((acc, item) => acc + parseFloat(item.amount || item.subtotal || 0), 0).toFixed(2));
        const finalTotalBase = parseFloat((finalTotalPay - finalTotalIgv).toFixed(2));

        // Payload para el Hub
        const hubPayload = {
            tipo_doc: tipo === 'factura' ? '01' : '03',
            serie: serie,
            currency: 'PEN',
            company: { ruc: config.ruc, razon_social: config.razonSocial, address: config.direccion || '' },
            total_gravada: isExonerado ? 0 : finalTotalBase,
            total_exonerada: isExonerado ? finalTotalBase : 0,
            total_igv: finalTotalIgv,
            total_pay: finalTotalPay,
            total_text: numToText(finalTotalPay),
            client: {
                number: String(clienteDocumento || ''),
                name: clienteNombre || '',
                type: String(tipo === 'factura' ? '6' : '1'),
                address: clienteDireccion || ''
            },
            items: hubItems,
            legends: isExonerado ? [{ code: '1000', value: 'OP. EXONERADA' }] : []
        };

        // Crear registro local
        const invoice = await Invoice.create({
            tipo, serie, correlativo, clienteDocumento, clienteNombre, clienteDireccion,
            subtotal: finalTotalBase, igv: finalTotalIgv, total: finalTotalPay,
            items: JSON.stringify(items),
            UserId: userId
        });

        // Enviar al Hub si está activo
        let sunatResponse = null;
        if (config.facturacionElectronica && config.apiToken) {
            try {
                const resHub = await axios.post(`${SUNAT_HUB_URL}/generate/invoice`, hubPayload, {
                    headers: { Authorization: `Bearer ${config.apiToken}`, 'Content-Type': 'application/json' },
                    timeout: 20000
                });
                sunatResponse = resHub.data;
                await invoice.update({ sunatResponse: JSON.stringify(sunatResponse) });
            } catch (err) {
                sunatResponse = { error: err.response?.data?.message || err.message };
                await invoice.update({ sunatResponse: JSON.stringify(sunatResponse) });
            }
        }

        res.json({ success: true, invoice, sunatResponse });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
