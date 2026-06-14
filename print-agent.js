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

function poll() {
    const client = serverUrl.startsWith('https') ? https : http;
    const urlObj = new URL(`${serverUrl}/api/config/printers/pending`);

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
        req.destroy();
        log('[WARN] Timeout de conexion con el servidor. Reintentando...');
        currentPollInterval = Math.min(currentPollInterval + POLL_INTERVAL_ERR, POLL_INTERVAL_MAX);
        setTimeout(poll, currentPollInterval);
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
    const printerConfig = job.printerConfig || {};
    const ptype = (printerConfig.type || 'disabled').toUpperCase();
    log(`[PRINT] Procesando trabajo #${job.id} -> ${ptype}`);

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
