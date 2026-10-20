/**
 * Módulo Centralizado de Reglas de Facturación Electrónica (SUNAT)
 * Unifica las validaciones de comprobantes entre Cobro de Mesa y Detalle de Cuenta.
 */

export const GENERIC_NAMES = ['CLIENTE FINAL', 'Consumidor Final', 'CLIENTES VARIOS', 'Personal', 'Cliente', ''];

/**
 * Determina si un nombre es genérico o vacío
 */
export function isGenericClientName(name) {
    if (!name || typeof name !== 'string') return true;
    const clean = name.trim();
    return GENERIC_NAMES.some(g => g.toLowerCase() === clean.toLowerCase());
}

/**
 * Valida un formulario de comprobante según la normativa de SUNAT
 * @param {Object} params
 * @param {string} params.tipo 'boleta' | 'factura' | '03' | '01'
 * @param {number|string} params.total Monto total a emitir en la boleta/factura
 * @param {string} params.docNumber DNI o RUC
 * @param {string} params.customerName Nombre o Razón Social
 * @param {string} params.customerAddress Dirección fiscal
 * @returns {{ isValid: boolean, error: string | null }}
 */
export function validateInvoiceForm({ tipo, total, docNumber, customerName, customerAddress }) {
    const isFactura = tipo === 'factura' || tipo === '01';
    const numTotal = parseFloat(total) || 0;
    const cleanDoc = (docNumber || '').trim();
    const cleanName = (customerName || '').trim();
    const cleanAddress = (customerAddress || '').trim();

    // 1. REGLAS PARA FACTURA (01)
    if (isFactura) {
        if (!cleanDoc) {
            return { isValid: false, error: 'El RUC es obligatorio para emitir una Factura.' };
        }
        if (cleanDoc.length !== 11 || !/^\d+$/.test(cleanDoc)) {
            return { isValid: false, error: 'El RUC debe tener exactamente 11 dígitos numéricos.' };
        }
        const prefix = cleanDoc.substring(0, 2);
        if (!['10', '15', '17', '20'].includes(prefix)) {
            return { isValid: false, error: 'El RUC debe comenzar con 10, 15, 17 o 20.' };
        }
        if (!cleanName) {
            return { isValid: false, error: 'La Razón Social es obligatoria para emitir una Factura.' };
        }
        if (!cleanAddress) {
            return { isValid: false, error: 'La Dirección Fiscal es obligatoria para emitir una Factura.' };
        }
        return { isValid: true, error: null };
    }

    // 2. REGLAS PARA BOLETA (03)
    // A) Boleta mayor a S/ 700: SUNAT exige OBLIGATORIAMENTE DNI (o documento oficial) y Nombre completo
    if (numTotal > 700) {
        if (!cleanDoc) {
            return {
                isValid: false,
                error: 'Por normativa SUNAT, para boletas mayores a S/ 700.00 es obligatorio consignar el DNI del cliente.'
            };
        }
        if (cleanDoc.length < 8 || !/^\d+$/.test(cleanDoc)) {
            return {
                isValid: false,
                error: 'El DNI debe tener exactamente 8 dígitos numéricos para boletas mayores a S/ 700.00.'
            };
        }
        if (!cleanName || isGenericClientName(cleanName)) {
            return {
                isValid: false,
                error: 'Por normativa SUNAT, para boletas mayores a S/ 700.00 debe ingresar los nombres y apellidos del cliente.'
            };
        }
        return { isValid: true, error: null };
    }

    // B) Boleta menor o igual a S/ 700: Consumidor Final (DNI y Nombre opcionales)
    // Si el usuario ingresó algún documento, validamos que tenga formato correcto
    if (cleanDoc && cleanDoc !== '-' && cleanDoc !== '00000000') {
        if (cleanDoc.length !== 8 && cleanDoc.length !== 11) {
            return {
                isValid: false,
                error: 'Si consigna un documento para la boleta, debe ser un DNI de 8 dígitos.'
            };
        }
        if (!cleanName) {
            return {
                isValid: false,
                error: 'Si consigna un DNI, debe ingresar también el Nombre del cliente.'
            };
        }
    }

    // Válido para Consumidor Final sin documento o con DNI completo
    return { isValid: true, error: null };
}

/**
 * Helper rápido para deshabilitar botones de cobro en frontend
 * @returns {boolean} true si faltan datos obligatorios
 */
export function isInvoiceDataMissing({ tipo, total, docNumber, customerName, customerAddress }) {
    const { isValid } = validateInvoiceForm({ tipo, total, docNumber, customerName, customerAddress });
    return !isValid;
}

/**
 * Normaliza los datos antes de enviarlos a /api/billing/invoices
 * Garantiza que nunca se envíe '00000000' y que Consumidor Final use '-' y 'CLIENTE FINAL'.
 */
export function normalizeInvoicePayload({
    tipo,
    total,
    docNumber,
    customerName,
    customerAddress,
    items,
    accountId = null,
    userId = null,
    fechaEmision = null,
    observaciones = ''
}) {
    const isFactura = tipo === 'factura' || tipo === '01';
    const numTotal = parseFloat(total) || 0;
    const cleanDoc = (docNumber || '').trim();
    const cleanName = (customerName || '').trim();
    const cleanAddress = (customerAddress || '').trim();

    let finalDoc = cleanDoc;
    let finalName = cleanName;
    let finalAddress = cleanAddress || '-';

    if (isFactura) {
        finalDoc = cleanDoc;
        finalName = cleanName;
        finalAddress = cleanAddress || '-';
    } else {
        // Boleta
        finalAddress = '-';
        const isWithoutDoc = !cleanDoc || cleanDoc === '-' || cleanDoc === '00000000';
        
        if (numTotal <= 700 && isWithoutDoc) {
            finalDoc = '-';
            finalName = (!cleanName || isGenericClientName(cleanName)) ? 'CLIENTE FINAL' : cleanName;
        } else {
            finalDoc = cleanDoc;
            finalName = cleanName || 'CLIENTE FINAL';
        }
    }

    const payload = {
        tipo: isFactura ? 'factura' : 'boleta',
        clienteDocumento: finalDoc,
        clienteNombre: finalName,
        clienteDireccion: finalAddress,
        items: items || [],
        accountId,
        userId,
        observaciones: observaciones || ''
    };

    if (fechaEmision) {
        payload.fecha_emision = fechaEmision;
        payload.fechaEmision = fechaEmision;
    }

    return payload;
}
