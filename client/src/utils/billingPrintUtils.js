/**
 * billingPrintUtils.js
 * Utilidades para generación de HTML de tickets imprimibles (comprobantes SUNAT).
 * Extraído de TableControl.jsx para reducir su tamaño sin alterar la lógica.
 */

/**
 * Genera el HTML completo del ticket imprimible para un comprobante electrónico.
 * @param {object} invoice - El objeto invoice del backend.
 * @param {object|null} billingConfig - Configuración de facturación (RUC, razón social, etc).
 * @param {string} paymentMethod - Método de pago (efectivo, yape, etc).
 * @param {object|null} successInvoice - El objeto successInvoice del estado React (para detectar si fue aceptado por SUNAT).
 * @returns {string} HTML string listo para imprimir.
 */
export function generatePrintableHtml(invoice, billingConfig, paymentMethod, successInvoice) {
    const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : (invoice.items || []);
    const dateStr = invoice.createdAt ? new Date(invoice.createdAt).toLocaleString() : new Date().toLocaleString();
    const docName = invoice.tipo === 'factura' ? 'FACTURA ELECTRÓNICA' : 'BOLETA ELECTRÓNICA';

    const rucEmpresa = billingConfig?.ruc || '20614409593';
    const nameEmpresa = billingConfig?.razonSocial || 'GESTIÓN RESTAURANTE EIRL';
    const addressEmpresa = billingConfig?.direccion || 'Av. Larco 123, Miraflores, Lima';

    // Check for Amazonas exoneration (exoneradas or igv === 0)
    const isExonerated = billingConfig?.operacionesExoneradas || parseFloat(invoice.igv || 0) === 0;
    const totalAmount = parseFloat(invoice.total || 0);
    const igvAmount = isExonerated ? 0 : parseFloat(invoice.igv || 0);
    const opAmount = isExonerated ? totalAmount : parseFloat(invoice.subtotal || 0);
    const opLabel = isExonerated ? 'OP. EXONERADA:' : 'OP. GRAVADA:';
    const igvLabel = isExonerated ? 'I.G.V. (0%):' : `I.G.V. (${billingConfig?.igvTasa || 18}%):`;

    // Generate SUNAT QR Code pipe-delimited string
    const tipoComp = invoice.tipo === 'factura' ? '01' : '03';
    let tipoDocAdq = '0';
    if (invoice.clienteDocumento) {
        if (invoice.clienteDocumento.length === 11) tipoDocAdq = '6'; // RUC
        else if (invoice.clienteDocumento.length === 8) tipoDocAdq = '1'; // DNI
    }
    const nroDocAdq = invoice.clienteDocumento || '00000000';

    const rawDate = invoice.emitidoAt || invoice.createdAt || new Date();
    const dateObj = new Date(rawDate);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const formattedDate = `${yyyy}-${mm}-${dd}`;

    const qrString = `${rucEmpresa}|${tipoComp}|${invoice.serie}|${invoice.correlativo}|${igvAmount.toFixed(2)}|${totalAmount.toFixed(2)}|${formattedDate}|${tipoDocAdq}|${nroDocAdq}|`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrString)}`;

    // Verify if it is electronic (successfully sent to SUNAT Hub)
    const isElectronico = !!(
        (invoice.sunatResponse || successInvoice?.sunatResponse) &&
        (() => {
            try {
                const rawResp = invoice.sunatResponse || successInvoice?.sunatResponse;
                const parsed = typeof rawResp === 'string' ? JSON.parse(rawResp) : rawResp;
                return parsed && !parsed.error && parsed.success !== false;
            } catch (e) {
                return false;
            }
        })()
    );

    const clienteDireccionHtml = invoice.clienteDireccion ? `<div><b>DIRECCIÓN:</b> ${invoice.clienteDireccion.toUpperCase()}</div>` : '';

    return `
        <html>
        <head>
            <title>${invoice.tipo === 'factura' ? 'Factura' : 'Boleta'}-${invoice.serie}-${String(invoice.correlativo).padStart(6, '0')}</title>
            <style>
                @page {
                    size: 80mm auto;
                    margin: 0;
                }
                body {
                    font-family: 'Courier New', Courier, monospace, sans-serif;
                    width: 72mm;
                    margin: 0 auto;
                    padding: 5mm 2mm;
                    font-size: 11px;
                    color: #000;
                    line-height: 1.3;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .bold { font-weight: bold; }
                .header { margin-bottom: 5mm; }
                .company-name { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
                .document-title { font-size: 12px; font-weight: bold; border: 1px solid #000; padding: 4px; margin: 4mm 0; text-transform: uppercase; }
                .divider { border-top: 1px dashed #000; margin: 3mm 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 2mm; }
                th { border-bottom: 1px dashed #000; padding: 2px 0; font-size: 10px; text-transform: uppercase; }
                td { padding: 3px 0; vertical-align: top; }
                .totals { margin-top: 4mm; }
                .totals-row { display: flex; justify-content: space-between; font-size: 11px; padding: 1px 0; }
                .footer { margin-top: 8mm; font-size: 9px; }
                .sunat-badge {
                    background-color: #e6f4ea;
                    color: #137333;
                    font-weight: bold;
                    border: 1px solid #a8dab5;
                    padding: 4px 8px;
                    border-radius: 4px;
                    display: inline-block;
                    font-size: 10px;
                    text-transform: uppercase;
                    margin-bottom: 3mm;
                }
            </style>
        </head>
        <body>
            <div class="text-center header">
                <div class="company-name">${nameEmpresa}</div>
                <div>RUC: ${rucEmpresa}</div>
                <div>${addressEmpresa.toUpperCase()}</div>
                <div class="document-title">
                    ${docName}<br>
                    ${invoice.serie}-${String(invoice.correlativo).padStart(6, '0')}
                </div>
            </div>
            
            <div>
                <div><b>FECHA EMISIÓN:</b> ${dateStr}</div>
                <div><b>SEÑOR(ES):</b> ${(invoice.clienteNombre || 'CLIENTES VARIOS').toUpperCase()}</div>
                <div><b>${invoice.tipo === 'factura' ? 'RUC' : 'DNI'}:</b> ${nroDocAdq}</div>
                ${clienteDireccionHtml}
                <div><b>MÉTODO PAGO:</b> ${(paymentMethod ? paymentMethod : 'EFECTIVO').toUpperCase()}</div>
            </div>
            
            <div class="divider"></div>
            
            <table>
                <thead>
                    <tr>
                        <th class="text-center" style="width: 10%;">CANT</th>
                        <th style="width: 45%;">DESCRIPCIÓN</th>
                        <th class="text-right" style="width: 20%;">P.UNIT</th>
                        <th class="text-right" style="width: 25%;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => {
                        const qty = item.qty || item.quantity || 1;
                        const total = parseFloat(item.amount || item.subtotal || 0);
                        const pUnit = total / qty;
                        return `
                            <tr>
                                <td class="text-center">${qty}</td>
                                <td style="text-transform: uppercase;">${item.description}</td>
                                <td class="text-right">S/ ${pUnit.toFixed(2)}</td>
                                <td class="text-right">S/ ${total.toFixed(2)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            
            <div class="divider"></div>
            
            <div class="totals">
                <div class="totals-row">
                    <span>${opLabel}</span>
                    <span>S/ ${opAmount.toFixed(2)}</span>
                </div>
                <div class="totals-row">
                    <span>OP. INAFECTA:</span>
                    <span>S/ 0.00</span>
                </div>
                <div class="totals-row">
                    <span>${igvLabel}</span>
                    <span>S/ ${igvAmount.toFixed(2)}</span>
                </div>
                <div class="totals-row bold" style="font-size: 13px;">
                    <span>TOTAL A PAGAR:</span>
                    <span>S/ ${totalAmount.toFixed(2)}</span>
                </div>
            </div>
            
            <div class="divider"></div>
            
            ${isElectronico ? `
            <div class="text-center" style="margin-top: 3mm; margin-bottom: 3mm;">
                <div class="sunat-badge">
                    [✓] ACEPTADA POR SUNAT
                </div>
            </div>
            ` : ''}

            <div class="text-center" style="margin-top: 4mm; margin-bottom: 4mm;">
                <img src="${qrCodeUrl}" style="width: 120px; height: 120px;" alt="Código QR SUNAT" />
            </div>

            <div class="text-center footer">
                <b>REPRESENTACIÓN IMPRESA DE COMPROBANTE DE PAGO</b><br>
                <span>Autorizado mediante Resolución de SUNAT</span><br><br>
                <b>¡Gracias por su preferencia!</b>
            </div>
        </body>
        </html>
    `;
}

// Lock global para prevenir impresiones múltiples por doble clic rápido.
// Se libera 2 segundos después de cada impresión.
let _printLocked = false;

/**
 * Inyecta el HTML en un iframe invisible y dispara el diálogo de impresión del navegador.
 * Incluye un lock de 2 segundos para prevenir copias duplicadas por doble clic.
 * @param {string} htmlString - HTML generado por generatePrintableHtml.
 */
export function triggerIframePrint(htmlString) {
    // Guard: evitar doble impresión si ya hay una en curso
    if (_printLocked) {
        console.warn('[billingPrintUtils] Impresión ignorada: ya hay una en proceso.');
        return;
    }
    _printLocked = true;
    // Liberar el lock después de 2 segundos (tiempo suficiente para que el diálogo aparezca)
    setTimeout(() => { _printLocked = false; }, 2000);

    let iframe = document.getElementById('print-iframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
    }

    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(htmlString);
    iframe.contentWindow.document.close();

    // Trigger print after load
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    }, 300);
}
