const express = require('express');
const router = express.Router();
const axios = require('axios');
const {
  BillingConfig,
  Invoice,
  User,
  Account,
  Table,
  Order,
  Product
} = require('../models');
const {
  Op
} = require('sequelize');
const {
  cleanString,
  cleanOptionalString
} = require('../utils/sanitize');
const SUNAT_HUB_URL = process.env.SUNAT_HUB_URL || 'https://sunat.maksuites.com.pe';

// Convert number to Peruvian text (simple version)
function numToText(n) {
  const fn = parseFloat(n).toFixed(2);
  const [whole, cents] = fn.split('.');
  return `${whole} CON ${cents}/100 SOLES`;
}

const GENERIC_NAMES = ['cliente final', 'consumidor final', 'clientes varios', 'personal', 'cliente', ''];
function isGenericName(name) {
  if (!name || typeof name !== 'string') return true;
  return GENERIC_NAMES.includes(name.trim().toLowerCase());
}

// Limpieza y traducción de errores técnicos de SUNAT / Hub a español amigable
function humanizeSunatError(errMsg) {
  if (!errMsg || typeof errMsg !== 'string') {
    return 'Ocurrió un problema al comunicarse con el servicio de SUNAT. Por favor, intente nuevamente.';
  }

  const lower = errMsg.toLowerCase();

  // 1. Timeouts de espera
  if (lower.includes('timeout') && lower.includes('exceeded')) {
    return 'SUNAT tardó demasiado tiempo en responder (tiempo límite agotado). Por favor, reintente en unos minutos.';
  }

  // 2. Conexión / Red
  if (lower.includes('network error') || lower.includes('econnrefused') || lower.includes('econnreset') || lower.includes('enotfound') || lower.includes('socket hang up')) {
    return 'No se pudo conectar con el servidor de facturación electrónica. Verifique su conexión a internet o reintente en unos momentos.';
  }

  // 3. Fallas internas de almacenamiento en SUNAT (0132, 0133)
  if (lower.includes('archivo backup') || lower.includes('archivo zip') || lower.includes('0132')) {
    return 'SUNAT presenta saturación temporal en sus servidores (no puede almacenar el archivo). Espere unos minutos o cobre sin comprobante fiscal por ahora.';
  }
  if (lower.includes('entrada del log') || lower.includes('dejar traza') || lower.includes('0133')) {
    return 'SUNAT se encuentra en mantenimiento temporal o interrupción de servicio. Por favor, reintente en unos minutos.';
  }

  // 4. Ticket 422 / 0130
  if (lower.includes('obtener ticket error') || lower.includes('422') || lower.includes('ticket de proceso') || lower.includes('0130')) {
    return 'SUNAT no pudo procesar el ticket del comprobante (Error 422 en SUNAT). Por favor, espere un momento y vuelva a intentar.';
  }

  // 5. Documento igual en proceso (0140)
  if (lower.includes('existe un documento igual en proceso') || lower.includes('0140') || lower.includes('15 minutos')) {
    return 'Existe un documento igual en proceso en SUNAT. Por favor, espere unos minutos antes de volver a enviar.';
  }

  // 6. Error 500 / Internal error
  if (lower.includes('status code 500') || lower.includes('internal error')) {
    return 'Error interno en los servidores de SUNAT. El servicio tributario está intermitente. Reintente en breve.';
  }

  // 7. Limpiar prefijos y detalles técnicos
  let clean = errMsg
    .replace(/^Error de SUNAT Hub( al anular)?:\s*/i, '')
    .replace(/^SUNAT ERROR:\s*/i, '')
    .replace(/- Detalle:.*$/is, '')
    .trim();

  return clean || 'SUNAT no pudo procesar la solicitud en este momento. Intente nuevamente.';
}

// GET /billing/config
router.get('/billing/config', async (req, res) => {
  try {
    let config = await BillingConfig.findOne({
      where: {
        TenantId: req.tenant.id
      }
    });
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
    res.status(500).json({
      error: err.message
    });
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

    if (data.ruc !== undefined) data.ruc = cleanOptionalString(data.ruc, 11);
    if (data.razonSocial !== undefined) data.razonSocial = cleanOptionalString(data.razonSocial, 150);
    if (data.direccion !== undefined) data.direccion = cleanOptionalString(data.direccion, 200);
    if (data.serieFactura !== undefined) data.serieFactura = cleanString(data.serieFactura, 10);
    if (data.serieBoleta !== undefined) data.serieBoleta = cleanString(data.serieBoleta, 10);
    if (data.apiToken !== undefined) data.apiToken = cleanOptionalString(data.apiToken, 255);

    let config = await BillingConfig.findOne({
      where: {
        TenantId: req.tenant.id
      }
    });
    if (config) {
      await config.update(data);
    } else {
      config = await BillingConfig.create({
        ...data,
        TenantId: req.tenant.id
      });
    }
    res.json({
      success: true,
      config
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// GET /billing/consulta?doc=XXXXXXXX (Proxy to apis.net.pe)
router.get('/billing/consulta', async (req, res) => {
  const {
    doc
  } = req.query;
  if (!doc) return res.status(400).json({
    error: 'doc requerido'
  });
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
      const docFilters = [{
        clienteDocumento: {
          [Op.like]: `%${req.query.documento}%`
        }
      }, {
        clienteNombre: {
          [Op.like]: `%${req.query.documento}%`
        }
      }, {
        serie: {
          [Op.like]: `%${req.query.documento}%`
        }
      }];
      const num = parseInt(req.query.documento, 10);
      if (!isNaN(num)) {
        docFilters.push({
          correlativo: num
        });
      }
      where[Op.or] = docFilters;
    }
    if (!req.query.documento && (req.query.desde || req.query.hasta)) {
      where.emitidoAt = {};
      if (req.query.desde) where.emitidoAt[Op.gte] = new Date(req.query.desde + 'T00:00:00.000-05:00');
      if (req.query.hasta) where.emitidoAt[Op.lte] = new Date(req.query.hasta + 'T23:59:59.999-05:00');
    }
    const invoices = await Invoice.findAll({
      where: {
        ...where,
        TenantId: req.tenant.id
      },
      include: [{
        model: User,
        attributes: ['id', 'username']
      }, {
        model: Account,
        include: [Table]
      }],
      order: [['emitidoAt', 'DESC']],
      limit: 200
    });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// GET /public/comprobante/:hash
router.get('/public/comprobante/:hash', async (req, res) => {
  try {
    const {
      hash
    } = req.params;
    // The hash is expected to be base64 of "makala_{id}"
    const decoded = Buffer.from(hash, 'base64').toString('utf-8');
    if (!decoded.startsWith('makala_')) {
      return res.status(400).json({
        error: 'Enlace inválido'
      });
    }
    const invoiceId = decoded.split('_')[1];
    const invoice = await Invoice.findOne({
      where: {
        id: invoiceId
      },
      include: [{
        model: User,
        attributes: ['id', 'username']
      }, {
        model: Account,
        include: [Table]
      }]
    });
    if (!invoice) return res.status(404).json({
      error: 'Comprobante no encontrado'
    });
    const config = await BillingConfig.findOne({
      where: {
        TenantId: invoice.TenantId
      }
    });
    res.json({
      invoice,
      config
    });
  } catch (err) {
    res.status(500).json({
      error: 'Error procesando el enlace'
    });
  }
});

// POST /billing/invoices (Emitir via Hub)
router.post('/billing/invoices', async (req, res) => {
  try {
    const config = await BillingConfig.findOne({
      where: {
        TenantId: req.tenant.id
      }
    });
    if (!config) return res.status(400).json({
      error: 'Configuración no encontrada'
    });
    let {
      tipo,
      clienteDocumento,
      clienteNombre,
      clienteDireccion,
      observaciones,
      items,
      userId,
      accountId,
      fecha_emision,
      fechaEmision
    } = req.body;
    if (!tipo || !items?.length) return res.status(400).json({
      error: 'tipo e items son requeridos'
    });

    // Validar fecha de emisión retroactiva (máximo 3 días en el pasado según normativa SUNAT)
    const todayLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const [y, m, d] = todayLima.split('-').map(Number);
    const pastDate = new Date(y, m - 1, d);
    pastDate.setDate(pastDate.getDate() - 3);
    const minLima = pastDate.toLocaleDateString('en-CA');

    let targetFecha = todayLima;
    const requestedDate = fecha_emision || fechaEmision;
    if (requestedDate && typeof requestedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      if (requestedDate >= minLima && requestedDate <= todayLima) {
        targetFecha = requestedDate;
      }
    }
    const finalTotalPay = parseFloat(items.reduce((acc, item) => acc + parseFloat(item.amount || item.subtotal || 0), 0).toFixed(2));

    let clientTipoDoc = '1';
    if (tipo === 'factura') {
      if (!clienteDocumento) {
        return res.status(400).json({
          error: 'El número de RUC es requerido para emitir una factura.'
        });
      }
      const cleanDoc = String(clienteDocumento).trim();
      if (cleanDoc.length !== 11 || !/^\d+$/.test(cleanDoc)) {
        return res.status(400).json({
          error: 'El RUC debe tener exactamente 11 dígitos numéricos.'
        });
      }
      const prefix = cleanDoc.substring(0, 2);
      if (!['10', '15', '17', '20'].includes(prefix)) {
        return res.status(400).json({
          error: 'El RUC ingresado no es válido (debe empezar con 10, 15, 17 o 20).'
        });
      }
      if (config.ruc && cleanDoc === config.ruc.trim()) {
        return res.status(400).json({
          error: 'El RUC del receptor no puede ser igual al RUC de la empresa emisora.'
        });
      }
      if (!clienteNombre || String(clienteNombre).trim() === '') {
        return res.status(400).json({
          error: 'La Razón Social es requerida para emitir una factura.'
        });
      }
      clienteDocumento = cleanDoc;
      clienteNombre = String(clienteNombre).trim();
      clienteDireccion = clienteDireccion && String(clienteDireccion).trim() ? String(clienteDireccion).trim() : '-';
      clientTipoDoc = '6';
    } else {
      // Boleta (03)
      clienteDireccion = '-';
      const cleanDoc = String(clienteDocumento || '').trim();
      const isDocEmptyOrPlaceholder = !cleanDoc || cleanDoc === '-' || cleanDoc === '00000000';

      if (finalTotalPay > 700) {
        // Exigencia legal SUNAT: operaciones > S/ 700 requieren documento y nombres
        if (isDocEmptyOrPlaceholder) {
          return res.status(400).json({
            error: 'Por normativa SUNAT, para boletas mayores a S/ 700.00 es obligatorio consignar el DNI del cliente.'
          });
        }
        if (cleanDoc.length < 8 || !/^\d+$/.test(cleanDoc)) {
          return res.status(400).json({
            error: 'El DNI debe tener exactamente 8 dígitos numéricos para boletas mayores a S/ 700.00.'
          });
        }
        if (!clienteNombre || isGenericName(clienteNombre)) {
          return res.status(400).json({
            error: 'Por normativa SUNAT, para boletas mayores a S/ 700.00 debe ingresar los nombres y apellidos del cliente.'
          });
        }
        clienteDocumento = cleanDoc;
        clienteNombre = String(clienteNombre).trim();
        clientTipoDoc = '1';
      } else {
        // Boleta <= S/ 700: Consumidor Final (DNI opcional)
        if (isDocEmptyOrPlaceholder) {
          clienteDocumento = '-';
          clienteNombre = (!clienteNombre || isGenericName(clienteNombre)) ? 'CLIENTE FINAL' : String(clienteNombre).trim();
          clientTipoDoc = '0';
        } else {
          // El cliente solicitó DNI
          clienteDocumento = cleanDoc;
          clienteNombre = (!clienteNombre || isGenericName(clienteNombre)) ? 'CLIENTE FINAL' : String(clienteNombre).trim();
          clientTipoDoc = '1';
        }
      }
    }

    // Prevent double emission by checking if the requested items exceed the remaining account balance
    if (accountId) {
      const account = await Account.findOne({
        include: [{
          model: Invoice,
          where: {
            status: {
              [Op.ne]: 'anulado'
            }
          },
          required: false
        }, {
          model: Order,
          where: {
            status: {
              [Op.ne]: 'cancelled'
            }
          },
          required: false,
          include: [Product]
        }],
        where: {
          id: accountId,
          TenantId: req.tenant.id
        }
      });
      if (account) {
        let totalPossible = 0;
        if (account.accountType === 'staff') {
          // For staff accounts, the real payable amount is account.total (already discounted)
          totalPossible = parseFloat(account.total || 0);
        } else {
          if (account.Orders) {
            for (const ord of account.Orders) {
              const price = ord.priceAtOrder && !isNaN(ord.priceAtOrder) ? parseFloat(ord.priceAtOrder) : ord.Product?.price || 0;
              totalPossible += price * (ord.quantity || 1);
            }
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
        // finalTotalPay includes the negative discount line, so it already reflects net amount
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
      where: {
        tipo,
        serie,
        TenantId: req.tenant.id
      },
      order: [['correlativo', 'DESC']]
    });
    const correlativo = (lastInvoice?.correlativo || 0) + 1;

    // Desglose SUNAT (Lógica Gestion Mak)
    // SUNAT does not accept negative PriceAmount values (UBL format restriction).
    // When a DESCUENTO item is present (negative amount), distribute it proportionally
    // across the positive items before building the Hub payload.
    // The original items (with the discount line) are still saved to DB for display purposes.
    const positiveItems = items.filter(it => parseFloat(it.amount || 0) >= 0);
    const totalDiscount = items.filter(it => parseFloat(it.amount || 0) < 0).reduce((sum, it) => sum + Math.abs(parseFloat(it.amount || 0)), 0);
    const grossPositiveTotal = positiveItems.reduce((sum, it) => sum + parseFloat(it.amount || 0), 0);

    // Build adjusted items: reduce each positive item proportionally by the discount
    const adjustedItems = positiveItems.map(it => {
      const originalAmount = parseFloat(it.amount || 0);
      if (totalDiscount > 0 && grossPositiveTotal > 0) {
        const ratio = originalAmount / grossPositiveTotal;
        const discountShare = parseFloat((totalDiscount * ratio).toFixed(2));
        return {
          ...it,
          amount: parseFloat((originalAmount - discountShare).toFixed(2))
        };
      }
      return it;
    });

    // Recalculate finalTotalPay from adjusted items to ensure it matches net total
    // (small rounding differences can occur; this guarantees SUNAT totals are consistent)
    let total_base = 0;
    let total_igv = 0;
    const hubItems = adjustedItems.map((item, i) => {
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
        porcentaje_igv: isExonerado ? 0 : igvRate * 100,
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
      fecha_emision: targetFecha,
      currency: 'PEN',
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
        number: String(clienteDocumento || '-'),
        name: clienteNombre || 'CLIENTE FINAL',
        type: String(clientTipoDoc),
        address: clienteDireccion || '-'
      },
      items: hubItems,
      legends: isExonerado ? [{
        code: '1000',
        value: 'OP. EXONERADA'
      }] : []
    };

    // Validar que el usuario exista para evitar errores de llave foránea (FK)
    let validatedUserId = null;
    if (userId) {
      const userExists = await User.findOne({
        where: {
          id: userId,
          TenantId: req.tenant.id
        }
      });
      if (userExists) {
        validatedUserId = userId;
      }
    }

    // Crear registro local
    const emitidoAtDate = (targetFecha === todayLima) ? new Date() : new Date(`${targetFecha}T12:00:00-05:00`);
    const invoice = await Invoice.create({
      tipo,
      serie,
      correlativo,
      clienteDocumento: cleanOptionalString(clienteDocumento, 11),
      clienteNombre: cleanOptionalString(clienteNombre, 150),
      clienteDireccion: cleanOptionalString(clienteDireccion, 200),
      observaciones: cleanOptionalString(observaciones, 500),
      subtotal: finalTotalBase,
      igv: finalTotalIgv,
      total: finalTotalPay,
      items: JSON.stringify(items),
      emitidoAt: emitidoAtDate,
      UserId: validatedUserId,
      AccountId: accountId || null,
      TenantId: req.tenant.id
    });

    // Enviar al Hub si está activo
    let sunatResponse = null;
    if (config.facturacionElectronica && config.apiToken) {
      try {
        const resHub = await axios.post(`${SUNAT_HUB_URL}/generate/invoice`, hubPayload, {
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 45000
        });
        sunatResponse = resHub.data;
        if (!sunatResponse || sunatResponse.success === false || sunatResponse.error) {
          await invoice.destroy();
          const rawError = sunatResponse?.message || sunatResponse?.error || 'Error al emitir comprobante en SUNAT';
          return res.status(400).json({
            error: humanizeSunatError(rawError)
          });
        }

        // Apply SSL fix / subdomain replacement to the PDF URL in the response
        let ticketUrl = sunatResponse.url_ticket || sunatResponse.url || sunatResponse.pdf_url || sunatResponse.links && sunatResponse.links.pdf;
        if (ticketUrl && typeof ticketUrl === 'string') {
          if (ticketUrl.includes('72.61.57.199') || ticketUrl.includes('bluzcx') || ticketUrl.startsWith('http://')) {
            ticketUrl = ticketUrl.replace(/:\d+/g, '').replace(/http(s)?:\/\/[\w.-]+/g, 'https://sunat.maksuites.com.pe');

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
        return res.status(400).json({
          error: humanizeSunatError(errMsg)
        });
      }
    }
    res.json({
      success: true,
      invoice,
      sunatResponse
    });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// POST /api/billing/invoices/:id/anular
router.post('/billing/invoices/:id/anular', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      where: {
        id: req.params.id,
        TenantId: req.tenant.id
      }
    });
    if (!invoice) return res.status(404).json({
      error: 'Comprobante no encontrado'
    });
    if (invoice.status === 'anulado') {
      return res.status(200).json({
        success: true,
        message: 'El comprobante ya se encuentra anulado.',
        invoice
      });
    }
    const config = await BillingConfig.findOne({
      where: {
        TenantId: req.tenant.id
      }
    });
    if (!config) return res.status(400).json({
      error: 'Configuración no encontrada'
    });
    const reason = cleanString(req.body.reason || req.body.motivoText || 'ANULACION DE LA OPERACION', 255);
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

      // SUNAT does not accept negative PriceAmount values (UBL format restriction).
      // Distribute any discount items proportionally across positive items,
      // same logic as invoice creation (lines 257-272).
      const positiveItemsNC = rawItems.filter(it => parseFloat(it.amount || 0) >= 0);
      const totalDiscountNC = rawItems.filter(it => parseFloat(it.amount || 0) < 0).reduce((sum, it) => sum + Math.abs(parseFloat(it.amount || 0)), 0);
      const grossPositiveTotalNC = positiveItemsNC.reduce((sum, it) => sum + parseFloat(it.amount || 0), 0);
      const adjustedItemsNC = positiveItemsNC.map(it => {
        const originalAmount = parseFloat(it.amount || 0);
        if (totalDiscountNC > 0 && grossPositiveTotalNC > 0) {
          const ratio = originalAmount / grossPositiveTotalNC;
          const discountShare = parseFloat((totalDiscountNC * ratio).toFixed(2));
          return {
            ...it,
            amount: parseFloat((originalAmount - discountShare).toFixed(2))
          };
        }
        return it;
      });
      let total_gravada = 0;
      let total_exonerada = 0;
      let total_igv = 0;
      const hubItems = adjustedItemsNC.map((item, i) => {
        const lineTotal = parseFloat(item.amount || item.subtotal || 0);
        const qty = Math.max(1, parseInt(item.quantity || item.qty || 1));
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
          porcentaje_igv: isExonerado ? 0 : igvRate * 100,
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
      const isClientConsumidorFinal = !isFactura && (!invoice.clienteDocumento || invoice.clienteDocumento === '-' || invoice.clienteDocumento === '00000000');
      const noteClientDoc = isFactura ? String(invoice.clienteDocumento || '') : (isClientConsumidorFinal ? '-' : String(invoice.clienteDocumento || ''));
      const noteClientType = isFactura ? '6' : (isClientConsumidorFinal ? '0' : '1');
      const noteClientName = invoice.clienteNombre || (isClientConsumidorFinal ? 'CLIENTE FINAL' : 'CLIENTES VARIOS');

      const hubPayload = {
        tipo_doc: '07',
        serie: noteSeries,
        currency: 'PEN',
        ref_tipo_doc: refTipoDoc,
        ref_serie_correlativo: refSerieCorrelativo,
        motivo_code: '01',
        // Anulación de la operación
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
          number: noteClientDoc,
          name: noteClientName,
          type: noteClientType,
          address: invoice.clienteDireccion || '-'
        },
        items: hubItems,
        legends: isExonerado ? [{
          code: '1000',
          value: 'OP. EXONERADA'
        }] : []
      };
      try {
        const resHub = await axios.post(`${SUNAT_HUB_URL}/generate/note`, hubPayload, {
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 45000
        });
        const sunatResponse = resHub.data;
        if (!sunatResponse || sunatResponse.success === false || sunatResponse.error) {
          const rawError = sunatResponse?.message || sunatResponse?.error || 'Error al anular comprobante en SUNAT';
          return res.status(400).json({
            error: humanizeSunatError(rawError)
          });
        }
        let ticketUrl = sunatResponse.url_ticket || sunatResponse.url || sunatResponse.pdf_url;
        if (ticketUrl && typeof ticketUrl === 'string') {
          if (ticketUrl.includes('72.61.57.199') || ticketUrl.includes('bluzcx') || ticketUrl.startsWith('http://')) {
            ticketUrl = ticketUrl.replace(/:\d+/g, '').replace(/http(s)?:\/\/[\w.-]+/g, 'https://sunat.maksuites.com.pe');
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
          // Store only compact summary of the credit note — NOT the full Hub response
          // (full responses can include base64 XMLs that overflow the TEXT column)
          sunatResponse: JSON.stringify({
            ...JSON.parse(invoice.sunatResponse || '{}'),
            noteResponse: {
              success: sunatResponse.success,
              fileName: sunatResponse.fileName || sunatResponse.file_name || null,
              url: ticketUrl || null,
              hash: sunatResponse.hash || null,
              cdrStatus: sunatResponse.cdrStatus || sunatResponse.cdr_status || null
            }
          })
        });
      } catch (err) {
        const errMsg = err.response?.data?.message || err.response?.data?.error || err.message;
        return res.status(400).json({
          error: humanizeSunatError(errMsg)
        });
      }
    } else {
      // Local annulment fallback
      await invoice.update({
        status: 'anulado'
      });
    }
    res.json({
      success: true,
      invoice
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message
    });
  }
});

// POST /api/billing/invoices/:id/print - Print receipt on the thermal printer
router.post('/billing/invoices/:id/print', async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      Invoice,
      Account,
      Payment
    } = require('../models');
    const invoice = await Invoice.findOne({
      include: [{
        model: Account,
        include: [{
          model: Payment
        }]
      }],
      where: {
        id: id,
        TenantId: req.tenant.id
      }
    });
    if (!invoice) {
      return res.status(404).json({
        error: 'Comprobante no encontrado'
      });
    }
    const {
      triggerInvoicePrint
    } = require('../utils/printer');
    const printResult = await triggerInvoicePrint(invoice, invoice.Account);
    if (printResult.success) {
      res.json({
        success: true,
        message: 'Comprobante enviado a la impresora.'
      });
    } else if (printResult.error === 'disabled') {
      res.status(400).json({
        error: 'La impresora de Caja esta deshabilitada.'
      });
    } else {
      res.status(500).json({
        error: 'Fallo el envio a la impresora.',
        details: printResult.error
      });
    }
  } catch (err) {
    console.error("Error printing invoice:", err);
    res.status(500).json({
      error: err.message
    });
  }
});

// POST /api/billing/invoices/:id/mark-voided
router.post('/billing/invoices/:id/mark-voided', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      where: {
        id: req.params.id,
        TenantId: req.tenant.id
      }
    });
    if (!invoice) return res.status(404).json({
      error: 'Comprobante no encontrado'
    });
    await invoice.update({
      status: 'anulada'
    });

    // Return order status
    if (invoice.orderId) {
      const { Order } = require('../models');
      const order = await Order.findOne({
        where: {
          id: invoice.orderId,
          TenantId: req.tenant.id
        }
      });
      if (order) {
        await order.update({
          status: 'delivered'
        }); // Revert back to delivered instead of paid/billed
      }
    }
    return res.json({
      success: true
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
});
module.exports = router;