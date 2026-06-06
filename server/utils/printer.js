const { execFile } = require('child_process');
const path = require('path');

// In-memory print queue for local print agent when server is running in the cloud (Linux/Docker)
const pendingJobs = [];
let jobCounter = 0;
const isWindows = process.platform === 'win32';

// Helper to remove accents and special Spanish characters for 100% printer compatibility
function cleanSpanishChars(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/[ááâãäå]/g, 'a')
        .replace(/[ééêë]/g, 'e')
        .replace(/[ííîï]/g, 'i')
        .replace(/[óóôõö]/g, 'o')
        .replace(/[úúûü]/g, 'u')
        .replace(/[ññ]/g, 'n')
        .replace(/[ÁÁÂÃÄÅ]/g, 'A')
        .replace(/[ÉÉÊË]/g, 'E')
        .replace(/[ÍÍÎÏ]/g, 'I')
        .replace(/[ÓÓÔÕÖ]/g, 'O')
        .replace(/[ÚÚÛÜ]/g, 'U')
        .replace(/[ÑÑ]/g, 'N')
        .replace(/¿/g, '')
        .replace(/¡/g, '')
        .replace(/º/g, '.');
}

// ESC/POS Byte Buffer Builder
class EscPosBuilder {
    constructor() {
        this.buffer = [];
    }

    init() {
        this.writeHex('1b40'); // ESC @ (Initialize)
        return this;
    }

    alignLeft() {
        this.writeHex('1b6100'); // ESC a 0
        return this;
    }

    alignCenter() {
        this.writeHex('1b6101'); // ESC a 1
        return this;
    }

    alignRight() {
        this.writeHex('1b6102'); // ESC a 2
        return this;
    }

    bold(on = true) {
        this.writeHex(on ? '1b4501' : '1b4500'); // ESC E 1 / 0
        return this;
    }

    doubleSize(on = true) {
        this.writeHex(on ? '1d2111' : '1d2100'); // GS ! 17 (Double width + height)
        return this;
    }

    text(str) {
        const cleaned = cleanSpanishChars(str);
        const hex = Buffer.from(cleaned, 'ascii').toString('hex');
        this.writeHex(hex);
        return this;
    }

    line(str = '') {
        this.text(str + '\n');
        return this;
    }

    feed(lines = 1) {
        for (let i = 0; i < lines; i++) {
            this.line();
        }
        return this;
    }

    cut() {
        this.writeHex('1d5601'); // GS V 1 (Feed and partial cut)
        return this;
    }

    kickDrawer() {
        this.writeHex('1b700019fa'); // ESC p 0 25 250 (Kick drawer 1)
        return this;
    }

    writeHex(hexStr) {
        this.buffer.push(hexStr);
        return this;
    }

    toHex() {
        return this.buffer.join('');
    }
}

// Helper to format text left/right aligned on a 42-column ticket
function formatLine(left, right, width = 42) {
    left = cleanSpanishChars(left);
    right = cleanSpanishChars(right);
    const spacesNeeded = width - left.length - right.length;
    if (spacesNeeded <= 0) {
        // Truncate left to fit
        const truncatedLeft = left.substring(0, Math.max(5, width - right.length - 2));
        return truncatedLeft + '.. ' + right;
    }
    return left + ' '.repeat(spacesNeeded) + right;
}

// Helper to get active models dynamically to avoid circular dependencies
function getModels() {
    return require('../models');
}

// Fetch Printer Config from settings
async function getPrintersConfig() {
    const { Setting } = getModels();
    try {
        const setting = await Setting.findByPk('printer_config');
        if (setting) {
            return JSON.parse(setting.value);
        }
    } catch (err) {
        console.error("Error reading printer_config setting:", err);
    }
    // Default fallback (disabled)
    return {
        caja: { type: 'disabled', path: '', printerName: '' },
        cocina: { type: 'disabled', path: '', printerName: '' },
        barra: { type: 'disabled', path: '', printerName: '' }
    };
}

async function sendToPrinter(printerConfig, hexData) {
    if (!printerConfig || printerConfig.type === 'disabled') {
        console.log("Printer is disabled or not configured.");
        return { success: false, error: 'disabled' };
    }

    if (!isWindows) {
        // Queue the job for local print agent polling from the restaurant PC
        jobCounter++;
        const job = {
            id: jobCounter,
            printerConfig,
            hexData,
            createdAt: new Date()
        };
        pendingJobs.push(job);
        console.log(`[Printer Queue] Queued print job #${job.id} for local print agent.`);
        return { success: true, queued: true, jobId: job.id };
    }

    return new Promise((resolve) => {
        const scriptPath = path.join(__dirname, 'print_raw.ps1');
        const args = [
            '-NoProfile', '-ExecutionPolicy', 'Bypass',
            '-File', scriptPath,
            '-PrinterType', printerConfig.type,
            '-PrinterPath', printerConfig.path || '',
            '-PrinterName', printerConfig.printerName || '',
            '-HexData', hexData
        ];

        execFile('powershell.exe', args, (error, stdout, stderr) => {
            if (error) {
                console.error("[Printer Service] Execution Error:", error, stderr);
                resolve({ success: false, error, stderr });
            } else {
                console.log("[Printer Service] Output:", stdout);
                resolve({ success: true, stdout });
            }
        });
    });
}

// Global print handler that automatically routes to printers
async function printTicket(printerKey, builder) {
    const configs = await getPrintersConfig();
    let printerConfig = configs[printerKey];

    // Fallback: if Cocina/Barra is disabled, try to route to Caja
    if ((printerKey === 'cocina' || printerKey === 'barra') && (!printerConfig || printerConfig.type === 'disabled')) {
        console.log(`[Printer Fallback] ${printerKey} printer disabled. Routing comanda to Caja printer.`);
        printerConfig = configs['caja'];
    }

    if (!printerConfig || printerConfig.type === 'disabled') {
        console.warn(`[Printer] Target printer '${printerKey}' (or Caja fallback) is disabled.`);
        return { success: false, error: 'disabled' };
    }

    const hex = builder.toHex();
    return await sendToPrinter(printerConfig, hex);
}

// === TICKET TEMPLATE GENERATORS ===

// 1. Apertura de Turno (Shift Open)
async function triggerAperturaPrint(session, user) {
    const builder = new EscPosBuilder().init();
    builder.kickDrawer(); // Kick cash drawer at opening
    builder.alignCenter().doubleSize().bold().line("APERTURA DE CAJA").doubleSize(false).bold(false).feed(1);
    builder.alignLeft();
    builder.line(`Sesion ID: #${session.id}`);
    builder.line(`Abierto por: ${user ? user.displayName : 'Staff'}`);
    builder.line(`Fecha: ${new Date(session.openedAt).toLocaleString('es-PE')}`);
    builder.line("-".repeat(42));
    
    const formattedVal = `S/ ${Number(session.openingCash).toFixed(2)}`;
    builder.bold().line(formatLine("MONTO APERTURA EFECTIVO:", formattedVal)).bold(false);
    builder.line("-".repeat(42)).feed(4).cut();

    return await printTicket('caja', builder);
}

// 2. Cierre de Turno (Shift Close Report)
async function triggerCierrePrint(session, expected, countedDetails, user) {
    const builder = new EscPosBuilder().init();
    builder.alignCenter().doubleSize().bold().line("CIERRE DE CAJA").doubleSize(false).bold(false).feed(1);
    builder.alignLeft();
    builder.line(`Sesion ID: #${session.id}`);
    builder.line(`Abierto: ${new Date(session.openedAt).toLocaleString('es-PE')}`);
    builder.line(`Cerrado: ${new Date(session.closedAt || new Date()).toLocaleString('es-PE')}`);
    builder.line(`Abierto por: ${session.Opener ? session.Opener.displayName : 'Staff'}`);
    builder.line(`Cerrado por: ${user ? user.displayName : 'Staff'}`);
    builder.line("=".repeat(42));
    
    // Cash Summary
    builder.bold().line("RESUMEN DE EFECTIVO").bold(false);
    builder.line(formatLine(" (+) Caja Inicial:", `S/ ${Number(session.openingCash).toFixed(2)}`));
    
    // We calculate payments and expenses in cash
    const cashIn = expected.efectivoIn || 0;
    const cashOut = expected.efectivoOut || 0;
    builder.line(formatLine(" (+) Ventas Efectivo:", `S/ ${Number(cashIn).toFixed(2)}`));
    builder.line(formatLine(" (-) Egresos Efectivo:", `S/ ${Number(cashOut).toFixed(2)}`));
    builder.line("-".repeat(42));
    builder.bold().line(formatLine(" EFECTIVO ESPERADO:", `S/ ${Number(expected.efectivo).toFixed(2)}`)).bold(false);
    
    // Counted & Difference
    const counted = countedDetails ? parseFloat(countedDetails.countedCash || 0) : 0;
    const difference = counted - expected.efectivo;
    builder.line(formatLine(" EFECTIVO CONTADO:", `S/ ${Number(counted).toFixed(2)}`));
    builder.bold().line(formatLine(" DIFERENCIA:", `S/ ${Number(difference).toFixed(2)}`)).bold(false);
    
    builder.line("=".repeat(42));
    // Other Methods
    builder.bold().line("OTROS METODOS DE PAGO").bold(false);
    builder.line(formatLine(" Tarjeta:", `S/ ${Number(expected.tarjeta || 0).toFixed(2)}`));
    builder.line(formatLine(" Yape/Plin:", `S/ ${Number(expected.yape || 0).toFixed(2)}`));
    builder.line(formatLine(" Transferencia:", `S/ ${Number(expected.transferencia || 0).toFixed(2)}`));
    builder.line("-".repeat(42));
    
    const totalSales = (expected.efectivoIn || 0) + (expected.tarjeta || 0) + (expected.yape || 0) + (expected.transferencia || 0);
    builder.bold().line(formatLine(" TOTAL VENTAS TURNO:", `S/ ${Number(totalSales).toFixed(2)}`)).bold(false);
    
    // Sales summary category if exists
    if (expected.salesSummary) {
        builder.line("=".repeat(42));
        builder.bold().line("RESUMEN DE VENTAS POR CATEGORIA").bold(false);
        Object.entries(expected.salesSummary).forEach(([cat, data]) => {
            if (data.count > 0) {
                const label = `${cat} (${data.count})`;
                builder.line(formatLine(label, `S/ ${Number(data.total).toFixed(2)}`));
            }
        });
    }

    if (session.closingNotes) {
        builder.line("=".repeat(42));
        builder.bold().line("NOTAS DE CIERRE:").bold(false);
        builder.line(session.closingNotes);
    }
    
    builder.line("=".repeat(42)).feed(4).cut();

    return await printTicket('caja', builder);
}

// 3. Pre-cuenta (Table consumption detail)
async function triggerPreCuentaPrint(account, table, orders, payments, user) {
    const builder = new EscPosBuilder().init();
    
    // Load config for header name/address
    const { RestaurantConfig } = getModels();
    let rName = 'MI RESTAURANTE';
    let rAddress = '';
    try {
        const config = await RestaurantConfig.findOne();
        if (config) {
            rName = config.name || rName;
            rAddress = config.address || rAddress;
        }
    } catch (_) {}

    builder.alignCenter().doubleSize().bold().line(rName).doubleSize(false).bold(false);
    if (rAddress) builder.line(rAddress);
    builder.feed(1);
    
    builder.doubleSize().bold().line("PRE-CUENTA").doubleSize(false).bold(false).feed(1);
    builder.alignLeft();
    builder.line(`Mesa: ${table ? (table.number || table.id) : `Mesa #${account.TableId}`}`);
    builder.line(`Cuenta: #${account.id}`);
    builder.line(`Fecha: ${new Date().toLocaleString('es-PE')}`);
    builder.line(`Atendido por: ${user ? user.displayName : 'Staff'}`);
    builder.line("-".repeat(42));
    
    // Columns Header
    builder.bold().line(formatLine("Cant - Producto", "Total")).bold(false);
    builder.line("-".repeat(42));
    
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
    grouped.forEach(g => {
        const total = g.qty * g.price;
        subtotal += total;
        
        let desc = `${g.qty} x ${g.name}`;
        if (g.presentation) desc += ` (${g.presentation})`;
        builder.line(formatLine(desc, `S/ ${total.toFixed(2)}`));
        if (g.notes) {
            builder.line(`  * Nota: ${g.notes}`);
        }
    });

    builder.line("-".repeat(42));
    builder.bold().line(formatLine("TOTAL CONSUMO:", `S/ ${subtotal.toFixed(2)}`)).bold(false);

    // Payments / Abonos
    let totalPaid = 0;
    if (payments && payments.length > 0) {
        builder.line("-".repeat(42));
        builder.bold().line("PAGOS / ABONOS REALIZADOS:").bold(false);
        payments.forEach(p => {
            const amount = parseFloat(p.amount);
            totalPaid += amount;
            builder.line(formatLine(`  Abono (${p.method}):`, `- S/ ${amount.toFixed(2)}`));
        });
        builder.line("-".repeat(42));
        const remaining = Math.max(0, subtotal - totalPaid);
        builder.bold().line(formatLine("SALDO PENDIENTE:", `S/ ${remaining.toFixed(2)}`)).bold(false);
    }

    builder.feed(1).alignCenter();
    builder.line("ESTO NO ES UN COMPROBANTE FISCAL");
    builder.line("GRACIAS POR SU PREFERENCIA");
    builder.feed(4).cut();

    return await printTicket('caja', builder);
}

// 4. Comanda (Kitchen / Bar dish slips)
async function triggerComandaPrint(table, items, type, user) {
    const builder = new EscPosBuilder().init();
    
    builder.alignCenter();
    builder.doubleSize().bold().line(`COMANDA ${type.toUpperCase()}`).doubleSize(false).bold(false).feed(1);
    
    // Large Table Number
    builder.doubleSize().bold().line(`MESA: ${table ? (table.number || table.id) : 'N/A'}`).doubleSize(false).bold(false);
    builder.feed(1);
    
    builder.alignLeft();
    builder.line(`Fecha: ${new Date().toLocaleString('es-PE')}`);
    builder.line(`Mesero: ${user ? user.displayName : 'Staff'}`);
    builder.line("=".repeat(42));
    
    items.forEach(item => {
        let desc = `${item.quantity}x ${item.name || item.productName}`;
        if (item.presentation) desc += ` (${item.presentation})`;
        
        builder.bold().line(desc).bold(false);
        if (item.notes) {
            builder.line(`  * NOTA: ${item.notes}`);
        }
        
        // If combo sub-items exist, list them
        if (item.subItems && Array.isArray(item.subItems)) {
            item.subItems.forEach(sub => {
                builder.line(`    - ${sub.name || sub.productName}`);
            });
        }
        builder.line("-".repeat(42));
    });
    
    builder.feed(4).cut();

    const printerKey = type.toLowerCase() === 'barra' ? 'barra' : 'cocina';
    return await printTicket(printerKey, builder);
}

// 5. Boleta / Factura Fiscal (Electronic Receipt)
async function triggerInvoicePrint(invoice, account) {
    const builder = new EscPosBuilder().init();
    builder.kickDrawer(); // Kick cash drawer for sale receipts
    
    const { RestaurantConfig } = getModels();
    let rName = 'MI RESTAURANTE';
    let rAddress = '';
    try {
        const config = await RestaurantConfig.findOne();
        if (config) {
            rName = config.name || rName;
            rAddress = config.address || rAddress;
        }
    } catch (_) {}

    builder.alignCenter().doubleSize().bold().line(rName).doubleSize(false).bold(false);
    if (rAddress) builder.line(rAddress);
    builder.feed(1);
    
    builder.bold().line(`${invoice.tipo.toUpperCase()} ELECTRONICA`).bold(false);
    builder.bold().line(`SERIE: ${invoice.serie}  NRO: ${String(invoice.correlativo).padStart(6, '0')}`).bold(false);
    builder.feed(1);
    
    builder.alignLeft();
    builder.line(`Fecha de Emision: ${new Date(invoice.emitidoAt).toLocaleString('es-PE')}`);
    builder.line(`Cliente: ${invoice.clienteNombre || 'CLIENTES VARIOS'}`);
    if (invoice.clienteDocumento) builder.line(`Doc. Identidad: ${invoice.clienteDocumento}`);
    if (invoice.clienteDireccion) builder.line(`Direccion: ${invoice.clienteDireccion}`);
    builder.line("-".repeat(42));
    
    // Items
    builder.bold().line(formatLine("Cant - Descripcion", "Total")).bold(false);
    builder.line("-".repeat(42));
    
    let items = [];
    try {
        items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : (invoice.items || []);
    } catch (_) {}
    
    items.forEach(it => {
        builder.line(formatLine(`${it.qty} x ${it.description || it.name}`, `S/ ${Number(it.amount || 0).toFixed(2)}`));
    });
    
    builder.line("-".repeat(42));
    builder.line(formatLine("Subtotal (Gravada):", `S/ ${Number(invoice.subtotal).toFixed(2)}`));
    builder.line(formatLine("IGV (18%):", `S/ ${Number(invoice.igv).toFixed(2)}`));
    builder.bold().line(formatLine("TOTAL COMPROBANTE:", `S/ ${Number(invoice.total).toFixed(2)}`)).bold(false);
    
    builder.feed(1).alignCenter();
    builder.line("Representacion Impresa de Comprobante Electronico");
    builder.line("Consulte su comprobante en SUNAT");
    builder.line("GRACIAS POR SU COMPRA");
    builder.feed(4).cut();

    return await printTicket('caja', builder);
}

function getPendingJobs() {
    const jobs = [...pendingJobs];
    pendingJobs.length = 0;
    return jobs;
}

module.exports = {
    cleanSpanishChars,
    EscPosBuilder,
    formatLine,
    getPrintersConfig,
    sendToPrinter,
    printTicket,
    triggerAperturaPrint,
    triggerCierrePrint,
    triggerPreCuentaPrint,
    triggerComandaPrint,
    triggerInvoicePrint,
    getPendingJobs
};
