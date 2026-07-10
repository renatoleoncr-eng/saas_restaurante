const express = require('express');
const router = express.Router();
const axios = require('axios');
const { BillingConfig, Invoice, User, Account, Table, Order, Product } = require('../models');
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
        let config = await BillingConfig.findOne({ where: { TenantId: req.tenant.id } });
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
                apiToken: '',
                billingMode: 'libre'
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
        const fields = ['ruc', 'razonSocial', 'direccion', 'facturacionElectronica', 'igvTasa', 'operacionesExoneradas', 'serieFactura', 'serieBoleta', 'apiToken', 'billingMode', 'habilitarImpresion'];
        const data = {};
        fields.forEach(f => {
            if (req.body[f] !== undefined) data[f] = req.body[f];
        });

        let config = await BillingConfig.findOne({ where: { TenantId: req.tenant.id } });
        if (config) {
            await config.update(data);
        } else {
            config = await BillingConfig.create({ ...data, TenantId: req.tenant.id });
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
        if (req.query.documento) {
            const docFilters = [
                { clienteDocumento: { [Op.like]: `%${req.query.documento}%` } },
                { clienteNombre: { [Op.like]: `%${req.query.documento}%` } },
                { serie: { [Op.like]: `%${req.query.documento}%` } }
            ];
            const num = parseInt(req.query.documento, 10);
            if (!isNaN(num)) {
                docFilters.push({ correlativo: num });
            }
            where[Op.or] = docFilters;
        }
        if (req.query.desde || req.query.hasta) {
            where.emitidoAt = {};
            if (req.query.desde) where.emitidoAt[Op.gte] = new Date(req.query.desde + 'T00:00:00.000-05:00');
            if (req.query.hasta) where.emitidoAt[Op.lte] = new Date(req.query.hasta + 'T23:59:59.999-05:00');
        }

        const invoices = await Invoice.findAll({
            where: { ...where, TenantId: req.tenant.id },
            include: [
                { model: User, attributes: ['id', 'username'] },
                { model: Account, include: [Table] }
            ],
            order: [['emitidoAt', 'DESC']],
            limit: 200
        });
        res.json(invoices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /public/comprobante/:hash
router.get('/public/comprobante/:hash', async (req, res) => {
    try {
        const { hash } = req.params;
        // The hash is expected to be base64 of "makala_{id}"
        const decoded = Buffer.from(hash, 'base64').toString('utf-8');
        if (!decoded.startsWith('makala_')) {
            return res.status(400).json({ error: 'Enlace inválido' });
        }
        
        const invoiceId = decoded.split('_')[1];
        const invoice = await Invoice.findOne({
            where: { id: invoiceId },
            include: [
                { model: User, attributes: ['id', 'username'] },
                { model: Account, include: [Table] }
            ]
        });
        
        if (!invoice) return res.status(404).json({ error: 'Comprobante no encontrado' });
        
        const config = await BillingConfig.findOne({ where: { TenantId: invoice.TenantId } });
        res.json({ invoice, config });
    } catch (err) {
        res.status(500).json({ error: 'Error procesando el enlace' });
    }
});

// POST /billing/invoices (Emitir via Hub)
router.post('/billing/invoices', async (req, res) => {
    try {
        const config = await BillingConfig.findOne({ where: { TenantId: req.tenant.id } });
        if (!config) return res.status(400).json({ error: 'Configuración no encontrada' });

        const { tipo, clienteDocumento, clienteNombre, clienteDireccion, items, userId, accountId } = req.body;
        if (!tipo || !items?.length) return res.status(400).json({ error: 'tipo e items son requeridos' });
        
        // Validar RUC para Facturas (Exactamente 11 dígitos numéricos que comiencen con 10, 15, 17, 20)
        if (tipo === 'factura') {
            if (!clienteDocumento) {
                return res.status(400).json({ error: 'El número de RUC es requerido para emitir una factura.' });
            }
            const cleanDoc = clienteDocumento.trim();
            if (cleanDoc.length !== 11 || !/^\d+$/.test(cleanDoc)) {
                return res.status(400).json({ error: 'El RUC debe tener exactamente 11 dígitos numéricos.' });
            }
            const prefix = cleanDoc.substring(0, 2);
            if (!['10', '15', '17', '20'].includes(prefix)) {
                return res.status(400).json({ error: 'El RUC ingresado no es válido (debe empezar con 10, 15, 17 o 20).' });
            }
        }

        // Validar que el RUC del receptor no sea igual al RUC de la empresa emisora para Facturas
        if (tipo === 'factura' && clienteDocumento && config.ruc && clienteDocumento.trim() === config.ruc.trim()) {
            return res.status(400).json({ error: 'El RUC del receptor no puede ser igual al RUC de la empresa emisora.' });
        }

        // Prevent double emission by checking if the requested items exceed the remaining account balance
        const finalTotalPay = parseFloat(items.reduce((acc, item) => acc + parseFloat(item.amount || item.subtotal || 0), 0).toFixed(2));
        
        if (accountId) {
            const account = await Account.findByPk(accountId, {
                include: [
                    { model: Invoice, where: { status: { [Op.ne]: 'anulado' } }, required: false },
                    { model: Order, where: { status: { [Op.ne]: 'cancelled' } }, required: false, include: [Product] }
                ]
            });
            
            if (account) {
                let totalPossible = 0;
                if (account.Orders) {
                    for (const ord of account.Orders) {
                        const price = ord.priceAtOrder && !isNaN(ord.priceAtOrder) 
                            ? parseFloat(ord.priceAtOrder) 
                            : (ord.Product?.price || 0);
                        totalPossible += price * (ord.quantity || 1);
                    }
                }
                
                let totalAlreadyBilled = 0;
                if (account.Invoices) {
                    for (const inv of account.Invoices) {
                        totalAlreadyBilled += parseFloat(inv.total || 0);
                    }
                }
                
                const remainingBalance = Math.max(0, totalPossible - totalAlreadyBilled);
                
                // Allow a small tolerance for floating point issues (e.g. 0.05)
                if (finalTotalPay > remainingBalance + 0.05) {
                    return res.status(400).json({ 
                        error: `El saldo pendiente de la cuenta es S/ ${remainingBalance.toFixed(2)}, no puede emitir un comprobante por S/ ${finalTotalPay.toFixed(2)}. Posible comprobante duplicado.` 
                    });
                }
            }
        }

        const isExonerado = config.operacionesExoneradas;
        const afeCode = isExonerado ? '20' : '10';
        const igvRate = parseFloat(config.igvTasa) / 100;

        // Correlativo auto-incremental por serie
        const serie = tipo === 'factura' ? config.serieFactura : config.serieBoleta;
        const lastInvoice = await Invoice.findOne({
            where: { tipo, serie, TenantId: req.tenant.id },
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

        // Validar que el usuario exista para evitar errores de llave foránea (FK)
        let validatedUserId = null;
        if (userId) {
            const userExists = await User.findOne({ where: { id: userId, TenantId: req.tenant.id } });
            if (userExists) {
                validatedUserId = userId;
            }
        }

        // Crear registro local
        const invoice = await Invoice.create({
            tipo, serie, correlativo, clienteDocumento, clienteNombre, clienteDireccion,
            subtotal: finalTotalBase, igv: finalTotalIgv, total: finalTotalPay,
            items: JSON.stringify(items),
            UserId: validatedUserId,
            AccountId: accountId || null,
            TenantId: req.tenant.id
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
                if (!sunatResponse || sunatResponse.success === false || sunatResponse.error) {
                    await invoice.destroy();
                    return res.status(400).json({ error: sunatResponse?.message || sunatResponse?.error || 'Error al emitir comprobante en SUNAT Hub' });
                }

                // Apply SSL fix / subdomain replacement to the PDF URL in the response
                let ticketUrl = sunatResponse.url_ticket || sunatResponse.url || sunatResponse.pdf_url || (sunatResponse.links && sunatResponse.links.pdf);
                if (ticketUrl && typeof ticketUrl === 'string') {
                    if (ticketUrl.includes('72.61.57.199') || ticketUrl.includes('maksuites') || ticketUrl.includes('bluzcx')) {
                        ticketUrl = ticketUrl.replace(/:\d+/g, '').replace(/http:\/\/[\w.-]+/g, 'https://proxy-sunat.bluzcx.easypanel.host');
                        
                        // Update inside sunatResponse
                        if (sunatResponse.url_ticket) sunatResponse.url_ticket = ticketUrl;
                        if (sunatResponse.url) sunatResponse.url = ticketUrl;
                        if (sunatResponse.pdf_url) sunatResponse.pdf_url = ticketUrl;
                        if (sunatResponse.links && sunatResponse.links.pdf) sunatResponse.links.pdf = ticketUrl;
                    }
                }
                
                // Extraer el correlativo real asignado por el Hub para mantener sincronizado el correlativo local
                let realCorrelativo = correlativo;
                if (sunatResponse.fileName) {
                    const parts = sunatResponse.fileName.split('-');
                    if (parts.length === 4) {
                        const parsedNum = parseInt(parts[3], 10);
                        if (!isNaN(parsedNum)) {
                            realCorrelativo = parsedNum;
                        }
                    }
                }
                
                await invoice.update({ 
                    sunatResponse: JSON.stringify(sunatResponse),
                    correlativo: realCorrelativo
                });
            } catch (err) {
                await invoice.destroy();
                const errMsg = err.response?.data?.message || err.response?.data?.error || err.message;
                return res.status(400).json({ error: `Error de SUNAT Hub: ${errMsg}` });
            }
        }

        res.json({ success: true, invoice, sunatResponse });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/billing/invoices/:id/anular
router.post('/billing/invoices/:id/anular', async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ where: { id: req.params.id, TenantId: req.tenant.id } });
        if (!invoice) return res.status(404).json({ error: 'Comprobante no encontrado' });

        if (invoice.status === 'anulado') {
            return res.status(200).json({
                success: true,
                message: 'El comprobante ya se encuentra anulado.',
                invoice
            });
        }

        const config = await BillingConfig.findOne({ where: { TenantId: req.tenant.id } });
        if (!config) return res.status(400).json({ error: 'Configuración no encontrada' });

        const reason = req.body.reason || req.body.motivoText || 'ANULACION DE LA OPERACION';

        if (config.facturacionElectronica && config.apiToken) {
            const isFactura = invoice.tipo === 'factura';
            const refTipoDoc = isFactura ? '01' : '03';
            const refSerieCorrelativo = `${invoice.serie}-${String(invoice.correlativo).padStart(8, '0')}`;

            // Determine credit note series based on the original invoice series suffix
            const originalSeriesSuffix = invoice.serie.slice(-2);
            const noteSeries = (isFactura ? 'FC' : 'BC') + (originalSeriesSuffix.length === 2 ? originalSeriesSuffix : '01');

            const isExonerado = config.operacionesExoneradas;
            const afeCode = isExonerado ? '20' : '10';
            const taxName = isExonerado ? 'EXO' : 'IGV';
            const taxCode = isExonerado ? '9997' : '1000';
            const igvRate = parseFloat(config.igvTasa) / 100;

            const rawItems = JSON.parse(invoice.items || '[]');

            let total_gravada = 0;
            let total_exonerada = 0;
            let total_igv = 0;

            const hubItems = rawItems.map((item, i) => {
                const lineTotal = parseFloat(item.amount || item.subtotal || 0);
                const qty = parseInt(item.quantity || item.qty || 1);
                const unitTotal = lineTotal / qty;

                const unitBase = isExonerado ? unitTotal : parseFloat((unitTotal / (1 + igvRate)).toFixed(6));
                const unitPrecio = isExonerado ? unitTotal : parseFloat((unitBase * (1 + igvRate)).toFixed(6));
                const lineBase = parseFloat((unitBase * qty).toFixed(6));
                const lineIgv = isExonerado ? 0 : parseFloat((lineBase * igvRate).toFixed(6));

                if (isExonerado) {
                    total_exonerada += lineBase;
                } else {
                    total_gravada += lineBase;
                    total_igv += lineIgv;
                }

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
                    codigo_tipo_tributo: taxCode,
                    nombre_tributo: taxName,
                    codigo_tipo_internacional_tributo: 'VAT'
                };
            });

            const finalTotalIgv = isExonerado ? 0 : parseFloat(total_igv.toFixed(2));
            const finalTotalPay = parseFloat(invoice.total);
            const finalTotalBase = parseFloat((finalTotalPay - finalTotalIgv).toFixed(2));

            const hubPayload = {
                tipo_doc: '07',
                serie: noteSeries,
                currency: 'PEN',
                ref_tipo_doc: refTipoDoc,
                ref_serie_correlativo: refSerieCorrelativo,
                motivo_code: '01', // Anulación de la operación
                motivo_text: reason,
                company: { 
                    ruc: config.ruc, 
                    razon_social: config.razonSocial, 
                    address: config.direccion || '' 
                },
                total_gravada: isExonerado ? 0 : finalTotalBase,
                total_exonerada: isExonerado ? finalTotalBase : 0,
                total_igv: finalTotalIgv,
                total_pay: finalTotalPay,
                total_text: numToText(finalTotalPay),
                client: {
                    number: String(invoice.clienteDocumento || '00000000'),
                    name: invoice.clienteNombre || 'CLIENTES VARIOS',
                    type: String(isFactura ? '6' : '1'),
                    address: invoice.clienteDireccion || ''
                },
                items: hubItems,
                legends: isExonerado ? [{ code: '1000', value: 'OP. EXONERADA' }] : []
            };

            try {
                const resHub = await axios.post(`${SUNAT_HUB_URL}/generate/note`, hubPayload, {
                    headers: { Authorization: `Bearer ${config.apiToken}`, 'Content-Type': 'application/json' },
                    timeout: 25000
                });

                const sunatResponse = resHub.data;
                if (!sunatResponse || sunatResponse.success === false || sunatResponse.error) {
                    return res.status(400).json({ error: sunatResponse?.message || sunatResponse?.error || 'Error al anular comprobante en SUNAT Hub' });
                }

                let ticketUrl = sunatResponse.url_ticket || sunatResponse.url || sunatResponse.pdf_url;
                if (ticketUrl && typeof ticketUrl === 'string') {
                    if (ticketUrl.includes('72.61.57.199') || ticketUrl.includes('maksuites') || ticketUrl.includes('bluzcx')) {
                        ticketUrl = ticketUrl.replace(/:\d+/g, '').replace(/http:\/\/[\w.-]+/g, 'https://proxy-sunat.bluzcx.easypanel.host');
                    }
                }

                const rawNoteFileName = sunatResponse.fileName || sunatResponse.file_name || null;
                let finalNoteId = rawNoteFileName;
                if (rawNoteFileName && rawNoteFileName.split('-').length >= 4) {
                    const p = rawNoteFileName.split('-');
                    finalNoteId = `${p[2]}-${p[3].padStart(8, '0')}`;
                }

                await invoice.update({
                    status: 'anulado',
                    notaCredito: finalNoteId,
                    notaCreditoUrl: ticketUrl,
                    sunatResponse: JSON.stringify({
                        ...JSON.parse(invoice.sunatResponse || '{}'),
                        noteResponse: sunatResponse
                    })
                });

            } catch (err) {
                const errMsg = err.response?.data?.message || err.response?.data?.error || err.message;
                return res.status(400).json({ error: `Error de SUNAT Hub al anular: ${errMsg}` });
            }
        } else {
            // Local annulment fallback
            await invoice.update({ status: 'anulado' });
        }

        res.json({ success: true, invoice });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/billing/invoices/:id/print - Print receipt on the thermal printer
router.post('/billing/invoices/:id/print', async (req, res) => {
    try {
        const { id } = req.params;
        const { Invoice, Account, Payment } = require('../models');

        const invoice = await Invoice.findByPk(id, {
            include: [{ model: Account, include: [{ model: Payment }] }]
        });

        if (!invoice) {
            return res.status(404).json({ error: 'Comprobante no encontrado' });
        }

        const { triggerInvoicePrint } = require('../utils/printer');
        const printResult = await triggerInvoicePrint(invoice, invoice.Account);

        if (printResult.success) {
            res.json({ success: true, message: 'Comprobante enviado a la impresora.' });
        } else if (printResult.error === 'disabled') {
            res.status(400).json({ error: 'La impresora de Caja esta deshabilitada.' });
        } else {
            res.status(500).json({ error: 'Fallo el envio a la impresora.', details: printResult.error });
        }
    } catch (err) {
        console.error("Error printing invoice:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
