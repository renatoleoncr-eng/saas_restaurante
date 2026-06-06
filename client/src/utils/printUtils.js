import { formatTableName } from './tableUtils';

/**
 * Helper to trigger silent or standard browser printing using an iframe.
 */
function printHtmlViaIframe(htmlContent) {
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
    iframe.contentWindow.document.write(htmlContent);
    iframe.contentWindow.document.close();

    // Trigger print after resources load
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    }, 300);
}

/**
 * Print a pre-cuenta ticket locally from the browser.
 */
export function printLocalPreCuenta(account, billingConfig, currentUser) {
    if (!account) return;

    const orders = account.Orders || [];
    const payments = account.Payments || [];
    const tableName = account.Table ? formatTableName(account.Table) : `Mesa #${account.TableId}`;
    const waiterName = currentUser ? currentUser.displayName : 'Staff';
    const dateStr = new Date().toLocaleString('es-PE');

    const nameEmpresa = billingConfig?.razonSocial || 'GESTIÓN RESTAURANTE';
    const addressEmpresa = billingConfig?.direccion || '';

    // Group orders to avoid repeating items
    const grouped = [];
    orders.forEach(o => {
        const isCombo = !o.ProductId && o.notes;
        const name = isCombo ? `2x1: ${o.notes}` : (o.Product?.name || 'Producto');
        const price = parseFloat(o.priceAtOrder || 0);
        const pres = o.presentation;
        const notes = isCombo ? null : o.notes;

        const existing = grouped.find(g => g.name === name && g.price === price && g.presentation === pres && g.notes === notes);
        if (existing) {
            existing.qty += o.quantity;
        } else {
            grouped.push({ name, price, qty: o.quantity, presentation: pres, notes });
        }
    });

    let subtotal = 0;
    const itemsHtml = grouped.map(g => {
        const total = g.qty * g.price;
        subtotal += total;
        let desc = `${g.qty}x ${g.name}`;
        if (g.presentation) desc += ` (${g.presentation})`;
        let line = `
            <tr>
                <td colspan="3">${desc}</td>
                <td class="text-right">S/ ${total.toFixed(2)}</td>
            </tr>
        `;
        if (g.notes) {
            line += `
                <tr>
                    <td colspan="4" style="font-size: 9px; padding-left: 4mm; color: #555;">* Nota: ${g.notes}</td>
                </tr>
            `;
        }
        return line;
    }).join('');

    let paymentsHtml = '';
    let totalPaid = 0;
    if (payments.length > 0) {
        const paymentRows = payments.map(p => {
            const amount = parseFloat(p.amount);
            totalPaid += amount;
            return `
                <div class="totals-row">
                    <span>Abono (${p.method.toUpperCase()}):</span>
                    <span>- S/ ${amount.toFixed(2)}</span>
                </div>
            `;
        }).join('');
        const remaining = Math.max(0, subtotal - totalPaid);
        paymentsHtml = `
            <div class="divider"></div>
            <div class="totals">
                <div class="totals-row bold">
                    <span>PAGOS REALIZADOS:</span>
                    <span>S/ ${totalPaid.toFixed(2)}</span>
                </div>
                ${paymentRows}
                <div class="totals-row bold" style="font-size: 12px; margin-top: 1mm;">
                    <span>SALDO PENDIENTE:</span>
                    <span>S/ ${remaining.toFixed(2)}</span>
                </div>
            </div>
        `;
    }

    const printableHtml = `
        <html>
        <head>
            <title>Pre-cuenta-${account.id}</title>
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
                .header { margin-bottom: 4mm; }
                .company-name { font-size: 13px; font-weight: bold; text-transform: uppercase; }
                .divider { border-top: 1px dashed #000; margin: 3mm 0; }
                table { width: 100%; border-collapse: collapse; }
                td { padding: 2px 0; vertical-align: top; }
                .totals { margin-top: 3mm; }
                .totals-row { display: flex; justify-content: space-between; font-size: 11px; padding: 1px 0; }
            </style>
        </head>
        <body>
            <div class="text-center header">
                <div class="company-name">${nameEmpresa}</div>
                ${addressEmpresa ? `<div>${addressEmpresa.toUpperCase()}</div>` : ''}
                <div class="bold" style="font-size: 12px; margin-top: 3mm;">PRE-CUENTA</div>
            </div>
            
            <div>
                <div><b>MESA:</b> ${tableName}</div>
                <div><b>CUENTA:</b> #${account.id}</div>
                <div><b>FECHA:</b> ${dateStr}</div>
                <div><b>ATENDIDO POR:</b> ${waiterName.toUpperCase()}</div>
            </div>
            
            <div class="divider"></div>
            
            <table style="width: 100%;">
                <thead>
                    <tr style="border-bottom: 1px dashed #000; font-weight: bold;">
                        <td colspan="3">DESCRIPCIÓN</td>
                        <td class="text-right">TOTAL</td>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            
            <div class="divider"></div>
            
            <div class="totals">
                <div class="totals-row bold" style="font-size: 12px;">
                    <span>TOTAL CONSUMO:</span>
                    <span>S/ ${subtotal.toFixed(2)}</span>
                </div>
            </div>
            
            ${paymentsHtml}
            
            <div class="divider"></div>
            
            <div class="text-center" style="margin-top: 3mm; font-size: 9px;">
                <b>ESTO NO ES UN COMPROBANTE FISCAL</b><br>
                <span>GRACIAS POR SU PREFERENCIA</span>
            </div>
        </body>
        </html>
    `;

    printHtmlViaIframe(printableHtml);
}

/**
 * Print a comanda locally from the browser.
 */
export function printLocalComanda(table, cartItems, waiterName = 'Staff') {
    if (!cartItems || cartItems.length === 0) return;

    const tableName = table ? formatTableName(table) : 'N/A';
    const dateStr = new Date().toLocaleString('es-PE');

    const itemsHtml = cartItems.map(item => {
        let desc = `${item.quantity}x ${item.name || item.productName}`;
        if (item.presentation) desc += ` (${item.presentation})`;
        let line = `
            <tr>
                <td class="bold" style="font-size: 13px; text-transform: uppercase;">${desc}</td>
            </tr>
        `;
        if (item.notes) {
            line += `
                <tr>
                    <td style="font-size: 11px; padding-left: 4mm; text-transform: uppercase;">* NOTA: ${item.notes}</td>
                </tr>
            `;
        }
        if (item.subItems && Array.isArray(item.subItems)) {
            item.subItems.forEach(sub => {
                line += `
                    <tr>
                        <td style="font-size: 11px; padding-left: 4mm; text-transform: uppercase;">- ${sub.name || sub.productName}</td>
                    </tr>
                `;
            });
        }
        return line;
    }).join('');

    const printableHtml = `
        <html>
        <head>
            <title>Comanda-${tableName}</title>
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
                .bold { font-weight: bold; }
                .header { margin-bottom: 4mm; }
                .divider { border-top: 1px dashed #000; margin: 3mm 0; }
                table { width: 100%; border-collapse: collapse; }
                td { padding: 3px 0; }
            </style>
        </head>
        <body>
            <div class="text-center header">
                <div class="bold" style="font-size: 14px;">COMANDA</div>
                <div class="bold" style="font-size: 18px; margin-top: 1mm;">MESA: ${tableName}</div>
            </div>
            
            <div style="font-size: 11px;">
                <div><b>FECHA:</b> ${dateStr}</div>
                <div><b>MESERO:</b> ${waiterName.toUpperCase()}</div>
            </div>
            
            <div class="divider"></div>
            
            <table>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            
            <div class="divider"></div>
        </body>
        </html>
    `;

    printHtmlViaIframe(printableHtml);
}
