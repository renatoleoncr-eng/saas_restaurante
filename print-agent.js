/**
 * Agente de Impresión Local - Gestión Restaurante El Makala
 * 
 * Este proceso corre en segundo plano en la PC del restaurante.
 * Consulta periódicamente el servidor en la nube por trabajos de
 * impresión pendientes y los ejecuta usando la impresora local.
 * 
 * Se inicia automáticamente con Windows vía la carpeta de Inicio.
 * No requiere abrir nada manualmente.
 */

const https = require('https');
const http  = require('http');
const { execFile } = require('child_process');
const path  = require('path');
const fs    = require('fs');

const serverUrl  = process.argv[2] || 'https://makala.maksuites.com.pe';
const scriptPath = path.join(__dirname, 'server', 'utils', 'print_raw.ps1');
const logFile    = path.join(__dirname, 'print-agent.log');

// Backoff settings for when server is unreachable
const POLL_INTERVAL_OK    = 1000;   // 1s when server OK
const POLL_INTERVAL_ERR   = 5000;   // 5s on first error
const POLL_INTERVAL_MAX   = 30000;  // max 30s backoff
let   currentPollInterval = POLL_INTERVAL_OK;

// Log to both console and file (max 500KB, then truncate)
function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    try {
        const stat = fs.existsSync(logFile) ? fs.statSync(logFile) : null;
        if (stat && stat.size > 500 * 1024) {
            fs.writeFileSync(logFile, line + '\n');
        } else {
            fs.appendFileSync(logFile, line + '\n');
        }
    } catch (_) { /* ignore log write errors */ }
}

log('=============================================================');
log('  AGENTE DE IMPRESION LOCAL - GESTION RESTAURANTE');
log(`  Servidor: ${serverUrl}`);
log('=============================================================');

function getEnabledLocalPrinters() {
    const localConfigPath = path.join(__dirname, 'local-printer-config.json');
    if (!fs.existsSync(localConfigPath)) {
        return null;
    }
    try {
        const data = fs.readFileSync(localConfigPath, 'utf8');
        const config = JSON.parse(data);
        const enabled = [];
        for (const [key, val] of Object.entries(config)) {
            if (val && val.type && val.type !== 'disabled') {
                enabled.push(key);
            }
        }
        return enabled;
    } catch (err) {
        log(`[ERROR] Error al parsear local-printer-config.json: ${err.message}`);
        return null;
    }
}

function getLocalPrinterConfig(printerKey) {
    const localConfigPath = path.join(__dirname, 'local-printer-config.json');
    if (fs.existsSync(localConfigPath)) {
        try {
            const data = fs.readFileSync(localConfigPath, 'utf8');
            const config = JSON.parse(data);
            if (config && config[printerKey]) {
                return config[printerKey];
            }
        } catch (err) {
            log(`[ERROR] No se pudo leer local-printer-config.json: ${err.message}`);
        }
    }
    return null;
}

function poll() {
    const client = serverUrl.startsWith('https') ? https : http;
    
    const enabledPrinters = getEnabledLocalPrinters();
    let pendingUrl = `${serverUrl}/api/config/printers/pending`;
    
    if (enabledPrinters !== null) {
        if (enabledPrinters.length === 0) {
            // No printers configured or all disabled -> wait and retry later
            setTimeout(poll, POLL_INTERVAL_ERR);
            return;
        }
        pendingUrl += `?printers=${enabledPrinters.join(',')}`;
    }

    const urlObj = new URL(pendingUrl);

    const req = client.get(urlObj, { headers: { 'Cache-Control': 'no-cache' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode !== 200) {
                log(`[WARN] Servidor retorno estado ${res.statusCode}. Reintentando en ${currentPollInterval / 1000}s...`);
                currentPollInterval = Math.min(currentPollInterval * 2, POLL_INTERVAL_MAX);
                setTimeout(poll, currentPollInterval);
                return;
            }

            // Server OK - reset backoff
            currentPollInterval = POLL_INTERVAL_OK;

            try {
                const jobs = JSON.parse(data);
                if (jobs && jobs.length > 0) {
                    log(`[INFO] Recibidos ${jobs.length} trabajo(s) de impresion.`);
                    processJobs(jobs);
                } else {
                    setTimeout(poll, currentPollInterval);
                }
            } catch (err) {
                log(`[ERROR] Error al decodificar JSON: ${err.message}`);
                setTimeout(poll, POLL_INTERVAL_ERR);
            }
        });
    });

    req.setTimeout(10000, () => {
        log('[WARN] Timeout de conexion con el servidor. Destruyendo socket...');
        req.destroy();
    });

    req.on('error', (err) => {
        currentPollInterval = Math.min(currentPollInterval * 2 || POLL_INTERVAL_ERR, POLL_INTERVAL_MAX);
        log(`[WARN] Sin conexion (${err.message}). Reintentando en ${currentPollInterval / 1000}s...`);
        setTimeout(poll, currentPollInterval);
    });
}

function processJobs(jobs) {
    if (jobs.length === 0) {
        poll();
        return;
    }

    const job = jobs.shift();
    const localConfig = job.printerKey ? getLocalPrinterConfig(job.printerKey) : null;
    const printerConfig = localConfig || job.printerConfig || {};
    const ptype = (printerConfig.type || 'disabled').toUpperCase();
    
    log(`[PRINT] Procesando trabajo #${job.id} (Key: ${job.printerKey || 'caja'}) -> ${ptype}`);

    if (ptype === 'DISABLED') {
        log(`[WARN] Trabajo #${job.id} omitido porque la impresora local está deshabilitada.`);
        setTimeout(() => processJobs(jobs), 300);
        return;
    }

    const args = [
        '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath,
        '-PrinterType', printerConfig.type || 'disabled',
        '-PrinterPath', printerConfig.path || '',
        '-PrinterName', printerConfig.printerName || '',
        '-HexData', job.hexData
    ];

    execFile('powershell.exe', args, { timeout: 15000 }, (error, stdout, stderr) => {
        if (error) {
            log(`[ERROR] Trabajo #${job.id} fallo: ${error.message}`);
            if (stderr) log(`[ERROR] Detalle: ${stderr.trim()}`);
        } else {
            const info = stdout ? stdout.replace(/[\r\n]+/g, ' ').trim() : '';
            log(`[OK] Trabajo #${job.id} impreso. ${info}`);
        }
        setTimeout(() => processJobs(jobs), 300);
    });
}

// Start polling
poll();
