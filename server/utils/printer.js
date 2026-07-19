const { execFile } = require('child_process');
const path = require('path');

const EventEmitter = require('events');

// printEvent is used ONLY for real-time long-polling notification.
// Actual job persistence is now in the DB (PrintJob table).
const printEvent = new EventEmitter();
printEvent.setMaxListeners(100);
const isWindows = process.platform === 'win32';

function getModels() {
    return require('../models');
}

// ── In-memory caches to avoid redundant DB queries on every print ──
// Printer config: changes rarely (only when admin edits settings)
const _printerConfigCache = new Map(); // key: tenantId|'global' → { value, expiresAt }
const PRINTER_CONFIG_TTL = 30 * 1000; // 30 seconds

// Restaurant header: changes very rarely (name, RUC, address)
const _headerCache = new Map(); // key: tenantId|'global' → { value, expiresAt }
const HEADER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Invalidates the printer config cache for a tenant.
 * Call this after saving printer settings.
 */
function invalidatePrinterConfigCache(tenantId) {
    const key = tenantId ? String(tenantId) : 'global';
    _printerConfigCache.delete(key);
    console.log(`[PrinterCache] Invalidated printer config cache for tenant '${key}'.`);
}


const formatPrinterDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    let hh = d.getHours();
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12;
    hh = hh ? hh : 12;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year} ${hh}:${mm}:${ss} ${ampm}`;
};

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

    // Print QR code using ESC/POS GS ( k commands
    // qrData: string to encode
    qr(qrData, size = 4) {
        const data = cleanSpanishChars(qrData);
        const bytes = Buffer.from(data, 'ascii');
        const storeLen = bytes.length + 3; // cn(0x31) + fn(0x50) + m(0x30) = 3 overhead bytes
        const pL = storeLen & 0xff;
        const pH = (storeLen >> 8) & 0xff;

        // 1. Select QR model 2:  GS ( k 04 00 31 41 32 00
        //    cn=0x31  fn=0x41(set model)  n1=0x32(model2)  n2=0x00
        this.writeHex('1d286b040031413200');

        // 2. Set module size:  GS ( k 03 00 31 43 <size>
        //    cn=0x31  fn=0x43(set size)  n=size
        this.writeHex('1d286b03003143' + size.toString(16).padStart(2, '0'));

        // 3. Set error correction level M:  GS ( k 03 00 31 45 31
        //    cn=0x31  fn=0x45(set EC)  n=0x31(level M)
        this.writeHex('1d286b0300314531');

        // 4. Store QR data:  GS ( k pL pH 31 50 30 <data>
        //    cn=0x31  fn=0x50(store)  m=0x30
        this.writeHex('1d286b' + pL.toString(16).padStart(2, '0') + pH.toString(16).padStart(2, '0') + '315030');
        this.writeHex(bytes.toString('hex'));

        // 5. Print QR:  GS ( k 03 00 31 51 30
        //    cn=0x31  fn=0x51(print)  m=0x30
        this.writeHex('1d286b0300315130');

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

// Helper to format table name exactly as frontend formatTableName
function formatPrinterTable(table) {
    if (!table) return 'N/A';
    const areaName = table.Area ? table.Area.name : (table.areaName || table.areaname || '');
    if (!areaName || areaName.trim() === '') {
        return `MESA: ${table.number || table.id}`;
    }
    if (areaName.length === 1) {
        return `MESA: ${areaName}${table.number || table.id}`;
    }
    return `MESA: ${areaName} ${table.number || table.id}`.trim();
}


// Fetch Printer Config from settings

async function getPrintersConfig(tenantId) {
    const cacheKey = tenantId ? String(tenantId) : 'global';
    const cached = _printerConfigCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }

    const { Setting } = getModels();
    let result = {
        caja: { type: 'disabled', path: '', printerName: '' },
        cocina: { type: 'disabled', path: '', printerName: '' },
        barra: { type: 'disabled', path: '', printerName: '' }
    };
    try {
        const key = tenantId ? `printer_config_${tenantId}` : 'printer_config';
        let setting = await Setting.findByPk(key);
        
        // Fallback for migrated DBs
        if (!setting && tenantId) {
            setting = await Setting.findByPk('printer_config');
        }

        if (setting) {
            result = JSON.parse(setting.value);
        }
    } catch (err) {
        console.error("Error reading printer_config setting:", err);
    }

    _printerConfigCache.set(cacheKey, { value: result, expiresAt: Date.now() + PRINTER_CONFIG_TTL });
    return result;
}

async function sendToPrinter(printerKey, printerConfig, hexData) {
    if (!printerConfig || printerConfig.type === 'disabled') {
        console.log("Printer is disabled or not configured.");
        return { success: false, error: 'disabled' };
    }

    if (!isWindows) {
        // Determine which agent should handle this job
        let targetAgentId = printerConfig.agentId || null;
        let finalPrinterName = printerConfig.printerName || '';

        // Extract agent from printer name format: "[HOSTNAME] PrinterName"
        if (!targetAgentId && finalPrinterName) {
            const match = finalPrinterName.match(/^\[(.*?)\]\s*(.*)$/);
            if (match) {
                targetAgentId = match[1];
                finalPrinterName = match[2];
            }
        }

        // Build resolved config (with extracted printerName if applicable)
        const resolvedConfig = { ...printerConfig, printerName: finalPrinterName };

        // Persist job to DB so it survives server restarts and agent disconnects
        try {
            const { PrintJob } = getModels();
            const job = await PrintJob.create({
                printerKey: printerKey || 'caja',
                printerConfig: JSON.stringify(resolvedConfig),
                hexData,
                targetAgentId: targetAgentId || null,
                status: 'pending',
                TenantId: resolvedConfig.TenantId || null
            });
            console.log(`[Printer Queue] Saved print job #${job.id} to DB for agent '${targetAgentId || 'any'}' (${printerKey}).`);
            // Notify any connected long-polling agent immediately
            printEvent.emit('new_job');
            return { success: true, queued: true, jobId: job.id };
        } catch (dbErr) {
            console.error('[Printer Queue] Failed to save job to DB:', dbErr.message);
            return { success: false, error: dbErr.message };
        }
    }

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
        } else {
            console.log("[Printer Service] Output:", stdout);
        }
    });

    return { success: true, queued: true };
}

// Global print handler that automatically routes to printers
async function printTicket(printerKey, builder, tenantId) {
    const configs = await getPrintersConfig(tenantId);
    let printerConfig = configs[printerKey];
    let targetPrinterKey = printerKey;

    // Fallback: if Cocina/Barra is disabled, try to route to Caja
    if ((printerKey === 'cocina' || printerKey === 'barra') && (!printerConfig || printerConfig.type === 'disabled')) {
        console.log(`[Printer Fallback] ${printerKey} printer disabled. Routing comanda to Caja printer.`);
        printerConfig = configs['caja'];
        targetPrinterKey = 'caja';
    }

    if (!printerConfig || printerConfig.type === 'disabled') {
        console.warn(`[Printer] Target printer '${printerKey}' (or Caja fallback) is disabled.`);
        return { success: false, error: 'disabled' };
    }

    const hex = builder.toHex();
    return await sendToPrinter(targetPrinterKey, { ...printerConfig, TenantId: tenantId }, hex);
}

// === TICKET TEMPLATE GENERATORS ===

async function triggerAperturaPrint(session, user) {
    const tenantId = session.TenantId;
    const builder = new EscPosBuilder().init();
    builder.kickDrawer(); // Kick cash drawer at opening
    builder.alignCenter().doubleSize().bold().line("APERTURA DE CAJA").doubleSize(false).bold(false).feed(1);
    builder.alignLeft();
    builder.line(`Sesion ID: #${session.id}`);
    builder.line(`Abierto por: ${user ? user.displayName : 'Staff'}`);
    builder.line(`Fecha: ${formatPrinterDate(session.openedAt)}`);
    builder.line("-".repeat(42));
    
    const formattedVal = `S/ ${Number(session.openingCash).toFixed(2)}`;
    builder.bold().line(formatLine("MONTO APERTURA EFECTIVO:", formattedVal)).bold(false);
    builder.line("-".repeat(42)).feed(4).cut();

    return await printTicket('caja', builder, tenantId);
}

// 2. Cierre de Turno (Shift Close Report)
async function triggerCierrePrint(session, expected, countedDetails, user) {
    const tenantId = session.TenantId;
    const builder = new EscPosBuilder().init();
    builder.alignCenter().doubleSize().bold().line("CIERRE DE CAJA").doubleSize(false).bold(false).feed(1);
    builder.alignLeft();
    builder.line(`Sesion ID: #${session.id}`);
    builder.line(`Abierto: ${formatPrinterDate(session.openedAt)}`);
    builder.line(`Cerrado: ${formatPrinterDate(session.closedAt || new Date())}`);
    builder.line(`Abierto por: ${session.Opener ? session.Opener.displayName : 'Staff'}`);
    const closedByName = session.Closer ? session.Closer.displayName : (user ? user.displayName : 'Staff');
    builder.line(`Cerrado por: ${closedByName}`);
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
    
    // Counted & Difference for Cash
    const countedEfectivo = countedDetails?.counted?.efectivo || 0;
    const diffEfectivo = countedDetails?.differences?.efectivo || 0;
    builder.line(formatLine(" EFECTIVO CONTADO:", `S/ ${Number(countedEfectivo).toFixed(2)}`));
    builder.bold().line(formatLine(" DIFERENCIA:", `S/ ${Number(diffEfectivo).toFixed(2)}`)).bold(false);
    
    builder.line("=".repeat(42));
    // Other Methods
    builder.bold().line("OTROS METODOS DE PAGO").bold(false);
    
    const printMethodDetail = (name, exp, countedKey) => {
        const countedVal = countedDetails?.counted?.[countedKey] || 0;
        const diffVal = countedDetails?.differences?.[countedKey] || 0;
        builder.line(` ${name.toUpperCase()}`);
        builder.line(formatLine("   Esperado:", `S/ ${Number(exp || 0).toFixed(2)}`));
        builder.line(formatLine("   Real:", `S/ ${Number(countedVal).toFixed(2)}`));
        builder.line(formatLine("   Diferencia:", `S/ ${Number(diffVal).toFixed(2)}`));
    };

    printMethodDetail("Tarjeta", expected.tarjeta, 'tarjeta');
    printMethodDetail("Yape/Plin", expected.yape, 'yape');
    printMethodDetail("Transferencia", expected.transferencia, 'transferencia');
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
                // Add items detail
                if (data.items && data.items.length > 0) {
                    data.items.forEach(item => {
                        const itemNameStr = `${item.quantity}x ${item.name} ${item.presentation ? item.presentation : ''}`;
                        const itemName = cleanSpanishChars(itemNameStr.substring(0, 30));
                        builder.line(formatLine(`   - ${itemName}`, `S/ ${Number(item.total).toFixed(2)}`));
                    });
                }
            }
        });
    }

    if (session.closingNotes) {
        builder.line("=".repeat(42));
        builder.bold().line("NOTAS DE CIERRE:").bold(false);
        builder.line(session.closingNotes);
    }
    
    builder.line("=".repeat(42)).feed(4).cut();

    return await printTicket('caja', builder, tenantId);
}

// Helper to get restaurant header info (name, RUC, address) from BillingConfig or RestaurantConfig
// Results are cached for 5 minutes since this data changes very rarely.
async function getRestaurantHeader(tenantId) {
    const cacheKey = tenantId ? String(tenantId) : 'global';
    const cached = _headerCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }

    const { RestaurantConfig, BillingConfig } = getModels();
    let rName = 'MI RESTAURANTE';
    let rRuc = '';
    let rAddress = '';
    try {
        const whereClause = tenantId ? { TenantId: tenantId } : {};
        const billConfig = await BillingConfig.findOne({ where: whereClause });
        if (billConfig && billConfig.razonSocial) {
            rName = billConfig.razonSocial;
            rRuc = billConfig.ruc || '';
            rAddress = billConfig.direccion || '';
        } else {
            const config = await RestaurantConfig.findOne({ where: whereClause });
            if (config) {
                rName = config.name || rName;
                rAddress = config.address || rAddress;
            }
        }
    } catch (_) {
        try {
            const whereClause = tenantId ? { TenantId: tenantId } : {};
            const config = await RestaurantConfig.findOne({ where: whereClause });
            if (config) {
                rName = config.name || rName;
                rAddress = config.address || rAddress;
            }
        } catch (__) {}
    }

    const result = { name: rName, ruc: rRuc, address: rAddress };
    _headerCache.set(cacheKey, { value: result, expiresAt: Date.now() + HEADER_CACHE_TTL });
    return result;
}

// 3. Pre-cuenta (Table consumption detail)
async function triggerPreCuentaPrint(account, table, orders, payments, user) {
    const tenantId = account.TenantId || (table && table.TenantId);
    const builder = new EscPosBuilder().init();
    
    const header = await getRestaurantHeader(tenantId);

    builder.alignCenter().doubleSize().bold().line(header.name).doubleSize(false).bold(false);
    if (header.ruc) builder.line(`R.U.C. ${header.ruc}`);
    if (header.address) builder.line(header.address);
    builder.feed(1);
    
    builder.doubleSize().bold().line("PRE-CUENTA").doubleSize(false).bold(false).feed(1);
    builder.alignLeft();
    builder.line(table ? formatPrinterTable(table).replace('MESA: ', 'Mesa: ') : `Mesa: #${account.TableId}`);
    builder.line(`Cuenta: #${account.id}`);
    builder.line(`Fecha: ${formatPrinterDate(new Date())}`);
    builder.line(`Atendido por: ${user ? user.displayName : 'Staff'}`);
    builder.line("-".repeat(42));
    
    // Columns Header
    builder.bold().line(formatLine("Cant - Producto", "Total")).bold(false);
    builder.line("-".repeat(42));
    
    // Group orders to avoid repeating items
    const grouped = [];
    orders.forEach(o => {
        const isCombo = !o.ProductId && o.notes;
        const name = isCombo 
            ? (() => {
                const cleanNote = o.notes.replace(/^2x1:\s*/i, '');
                return cleanNote.includes(' + ') ? `2x1: ${cleanNote}` : cleanNote;
            })() 
            : (o.Product?.name || 'Producto');
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
            builder.line(`  * ${g.notes}`);
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

    return await printTicket('caja', builder, tenantId);
}

// 4. Comanda (Kitchen / Bar dish slips)
async function triggerComandaPrint(table, items, type, user) {
    const tenantId = table.TenantId;
    const builder = new EscPosBuilder().init();
    
    builder.alignCenter();
    builder.doubleSize().bold().line(`COMANDA ${type.toUpperCase()}`).doubleSize(false).bold(false).feed(1);
    
    // Large Table Number
    builder.doubleSize().bold().line(formatPrinterTable(table)).doubleSize(false).bold(false);
    builder.feed(1);
    
    builder.alignLeft();
    builder.line(`Fecha: ${formatPrinterDate(new Date())}`);
    builder.line(`Mesero: ${user ? user.displayName : 'Staff'}`);
    builder.line("=".repeat(42));
    
    items.forEach(item => {
        let desc = `${item.quantity}x ${item.name || item.productName}`;
        if (item.presentation) desc += ` (${item.presentation})`;
        
        builder.bold().line(desc).bold(false);
        if (item.notes && !item.notes.startsWith('Combo:')) {
            builder.line(`  * ${item.notes}`);
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
    return await printTicket(printerKey, builder, tenantId);
}

// Helper: Format date/time manually in 24h to avoid locale AM/PM artifacts (e.g. "p.am.")
function formatDateTime24h(date) {
    const d = new Date(date);
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = d.getFullYear();
    const hh    = String(d.getHours()).padStart(2, '0');
    const mm    = String(d.getMinutes()).padStart(2, '0');
    const ss    = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hh}:${mm}:${ss}`;
}

// 5. Boleta / Factura Fiscal (Electronic Receipt)
async function triggerInvoicePrint(invoice, account) {
    const tenantId = invoice.TenantId || (account && account.TenantId);
    const builder = new EscPosBuilder().init();
    builder.kickDrawer(); // Kick cash drawer for sale receipts

    // Read billing config for IGV rate and exoneration flag
    const { BillingConfig } = getModels();
    let igvTasa = 18;       // safe fallback
    let isExonerado = false;
    try {
        const whereClause = tenantId ? { TenantId: tenantId } : {};
        const billCfg = await BillingConfig.findOne({ where: whereClause });
        if (billCfg) {
            igvTasa     = parseFloat(billCfg.igvTasa) || 18;
            isExonerado = !!billCfg.operacionesExoneradas;
        }
    } catch (_) {}

    // Determine payment method from account payments
    let formaPago = 'CONTADO';
    if (account && account.Payments && account.Payments.length > 0) {
        const methods = [...new Set(account.Payments.map(p => (p.method || '').toUpperCase()))].filter(Boolean);
        if (methods.length > 0) formaPago = methods.join('+');
    }

    const header = await getRestaurantHeader(tenantId);

    // ─── HEADER ───────────────────────────────────────────────────────────────
    builder.alignCenter().doubleSize().bold().line(header.name).doubleSize(false).bold(false);
    if (header.ruc) builder.line(`R.U.C. ${header.ruc}`);
    if (header.address) builder.line(header.address);
    builder.feed(1);

    builder.bold().line(`${invoice.tipo.toUpperCase()} ELECTRONICA`).bold(false);
    builder.bold().line(`${invoice.serie}-${String(invoice.correlativo).padStart(8, '0')}`).bold(false);
    builder.line("-".repeat(42));

    // ─── FECHA, FORMA DE PAGO Y CLIENTE ───────────────────────────────────────
    builder.alignLeft();
    builder.line(`Fecha de emision: ${formatDateTime24h(invoice.emitidoAt)}`);
    builder.line(`Forma de Pago: ${formaPago}`);
    builder.feed(1);

    const tipoDocLabel = invoice.clienteDocumento && invoice.clienteDocumento.length === 11 ? 'RUC' : 'DNI';
    builder.line(`SENOR(ES): ${invoice.clienteNombre || 'CLIENTES VARIOS'}`);
    if (invoice.clienteDocumento) builder.line(`${tipoDocLabel}: ${invoice.clienteDocumento}`);
    if (invoice.clienteDireccion) builder.line(`Direccion: ${invoice.clienteDireccion}`);
    builder.line("-".repeat(42));

    // ─── ITEMS (con columnas: Cant | Descripcion | P.Unit | Total) ─────────────
    function padR(s, n) { s = String(s); return s.length >= n ? s.substring(0, n) : s + ' '.repeat(n - s.length); }
    function padL(s, n) { s = String(s); return s.length >= n ? s.substring(0, n) : ' '.repeat(n - s.length) + s; }

    // Column widths for 42-char ticket: Cant(4) Desc(23) P.Unit(7) Total(7) + 1 space each = 42
    const cantW  = 4;
    const unitW  = 7;
    const totW   = 7;
    const descW  = 42 - cantW - unitW - totW - 3; // 3 separator spaces = 21

    const hdr = padR('Cant', cantW) + ' ' + padR('Descripcion', descW) + ' ' + padL('P.Unit', unitW) + ' ' + padL('Total', totW);
    builder.bold().line(hdr).bold(false);
    builder.line("-".repeat(42));

    let itemsList = [];
    try {
        itemsList = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : (invoice.items || []);
    } catch (_) {}

    itemsList.forEach(it => {
        const qty       = parseInt(it.qty || it.quantity || 1);
        const lineTotal = Number(it.amount || 0);
        const desc      = String(it.description || it.name || '');

        if (lineTotal < 0) {
            // Discount line: print as full-width "DESCUENTO    -S/ XX.XX" without qty/unit columns
            const discStr = `-S/ ${Math.abs(lineTotal).toFixed(2)}`;
            const descTrunc = padR(desc, 42 - discStr.length - 1);
            builder.line(descTrunc + ' ' + discStr);
        } else {
            const unitPrice = qty > 0 ? (lineTotal / qty) : lineTotal;

            // Print first line
            const row = padR(String(qty), cantW) + ' ' + padR(desc, descW) + ' ' + padL(unitPrice.toFixed(2), unitW) + ' ' + padL(lineTotal.toFixed(2), totW);
            builder.line(row);

            // Print overflow lines for long descriptions
            if (desc.length > descW) {
                let rest = desc.substring(descW);
                while (rest.length > 0) {
                    builder.line(' '.repeat(cantW + 1) + rest.substring(0, descW));
                    rest = rest.substring(descW);
                }
            }
        }
    });

    builder.line("-".repeat(42));

    // ─── TOTALES E IMPUESTOS ──────────────────────────────────────────────────
    const subtotal = Number(invoice.subtotal); // base imponible
    const igv      = Number(invoice.igv);
    const total    = Number(invoice.total);

    // Always show all three operation lines (matching PDF)
    const opGravada   = isExonerado ? 0       : subtotal;
    const opExonerada = isExonerado ? subtotal : 0;
    const opInafecta  = 0; // not used currently

    builder.line(formatLine("Op. Gravada:",   `S/ ${opGravada.toFixed(2)}`));
    builder.line(formatLine("Op. Exonerada:", `S/ ${opExonerada.toFixed(2)}`));
    builder.line(formatLine("Op. Inafecta:",  `S/ ${opInafecta.toFixed(2)}`));
    builder.line(formatLine(`I.G.V. (${igvTasa.toFixed(1)}%):`, `S/ ${igv.toFixed(2)}`));
    builder.bold().line(formatLine("IMPORTE TOTAL:", `S/ ${total.toFixed(2)}`)).bold(false);

    // ─── QR CODE ──────────────────────────────────────────────────────────────
    let qrContent = null;
    try {
        const sunat = invoice.sunatResponse
            ? (typeof invoice.sunatResponse === 'string' ? JSON.parse(invoice.sunatResponse) : invoice.sunatResponse)
            : null;
        // Hub may return: qr_url, qr, hash, url_ticket, url, pdf_url
        qrContent = sunat?.qr_url || sunat?.qr || sunat?.hash || sunat?.url_ticket || sunat?.url || sunat?.pdf_url || null;
    } catch (_) {}

    // Fallback: standard SUNAT QR pipe-separated string
    if (!qrContent && header.ruc) {
        const tipoDoc         = invoice.tipo === 'factura' ? '01' : '03';
        const fechaEmision    = formatDateTime24h(invoice.emitidoAt).substring(0, 10);
        const tipoDocReceptor = invoice.clienteDocumento && invoice.clienteDocumento.length === 11 ? '6' : '1';
        qrContent = [
            header.ruc,
            tipoDoc,
            invoice.serie,
            String(invoice.correlativo).padStart(8, '0'),
            igv.toFixed(2),
            total.toFixed(2),
            fechaEmision,
            tipoDocReceptor,
            invoice.clienteDocumento || ''
        ].join('|');
    }

    builder.feed(1).alignCenter();
    if (qrContent) {
        builder.qr(qrContent, 4);
        builder.feed(1);
    }

    // ─── ACEPTADA POR SUNAT ───────────────────────────────────────────────────
    let isAceptada = false;
    try {
        const sunat = invoice.sunatResponse
            ? (typeof invoice.sunatResponse === 'string' ? JSON.parse(invoice.sunatResponse) : invoice.sunatResponse)
            : null;
        isAceptada = sunat?.success === true || !!sunat?.fileName || !!sunat?.url || !!sunat?.url_ticket;
    } catch (_) {}

    if (isAceptada) {
        builder.bold().line("** ACEPTADA POR SUNAT **").bold(false);
    }

    // ─── FOOTER ───────────────────────────────────────────────────────────────
    builder.line("Representacion impresa de un comprobante");
    builder.line("electronico.");
    builder.line("El documento puede ser consultado en el");
    builder.line("portal interno de su proveedor.");
    builder.feed(1);
    builder.line("Gracias por su preferencia.");
    builder.feed(4).cut();

    return await printTicket('caja', builder, tenantId);
}

// =============================================
// DB-backed print queue helpers
// =============================================

/**
 * Fetches pending print jobs from DB for a given agent.
 * Atomically marks them as 'processing' to prevent double-delivery.
 */
async function getPendingJobs(agentId) {
    const { PrintJob } = getModels();
    const { Op } = require('sequelize');

    const where = { status: 'pending' };
    if (agentId) {
        where[Op.or] = [
            { targetAgentId: agentId },
            { targetAgentId: null }
        ];
    }

    const jobs = await PrintJob.findAll({ where, order: [['createdAt', 'ASC']], limit: 20 });
    if (jobs.length === 0) return [];

    // Mark as processing to prevent other agents picking same job
    const ids = jobs.map(j => j.id);
    await PrintJob.update({ status: 'processing' }, { where: { id: ids } });

    return jobs.map(j => ({
        id: j.id,
        printerKey: j.printerKey,
        printerConfig: JSON.parse(j.printerConfig),
        hexData: j.hexData
    }));
}

/**
 * Fetches pending jobs filtered by printer keys.
 */
async function getPendingJobsForPrinters(printerKeys, agentId) {
    const { PrintJob } = getModels();
    const { Op } = require('sequelize');

    const where = {
        status: 'pending',
        printerKey: { [Op.in]: printerKeys }
    };
    if (agentId) {
        where[Op.or] = [
            { targetAgentId: agentId },
            { targetAgentId: null }
        ];
    }

    const jobs = await PrintJob.findAll({ where, order: [['createdAt', 'ASC']], limit: 20 });
    if (jobs.length === 0) return [];

    const ids = jobs.map(j => j.id);
    await PrintJob.update({ status: 'processing' }, { where: { id: ids } });

    return jobs.map(j => ({
        id: j.id,
        printerKey: j.printerKey,
        printerConfig: JSON.parse(j.printerConfig),
        hexData: j.hexData
    }));
}

/**
 * Acknowledge a completed job. Marks it done and deletes it.
 */
async function ackPrintJob(jobId, success, errorMessage) {
    const { PrintJob } = getModels();
    const job = await PrintJob.findByPk(jobId);
    if (!job) return;

    if (success) {
        await job.destroy(); // Clean up immediately on success
    } else {
        await job.update({ status: 'failed', errorMessage: errorMessage || 'unknown error' });
    }
}

/**
 * Cleanup: delete failed jobs older than 24h (called on server startup).
 */
async function cleanupOldPrintJobs() {
    try {
        const { PrintJob } = getModels();
        const { Op } = require('sequelize');
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const deleted = await PrintJob.destroy({
            where: {
                status: { [Op.in]: ['failed', 'processing'] },
                createdAt: { [Op.lt]: cutoff }
            }
        });
        if (deleted > 0) console.log(`[PrintJob Cleanup] Deleted ${deleted} stale print jobs.`);
    } catch (err) {
        console.error('[PrintJob Cleanup] Error:', err.message);
    }
}

module.exports = {
    cleanSpanishChars,
    formatPrinterDate,
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
    getPendingJobs,
    getPendingJobsForPrinters,
    ackPrintJob,
    cleanupOldPrintJobs,
    printEvent,
    invalidatePrinterConfigCache
};

