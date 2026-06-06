const https = require('https');
const http = require('http');
const { execFile } = require('child_process');
const path = require('path');

const serverUrl = process.argv[2] || 'https://makala.maksuites.com.pe';
console.log(`\n=============================================================`);
console.log(`  AGENTE DE IMPRESIÓN LOCAL - GESTIÓN RESTAURANTE`);
console.log(`  Servidor: ${serverUrl}`);
console.log(`  Impresoras configuradas en la nube se redirigirán aquí`);
console.log(`=============================================================\n`);
console.log(`[Print Agent] Iniciando escucha de cola de impresión...`);
console.log(`[Print Agent] Presione Ctrl+C para detener el agente.\n`);

const scriptPath = path.join(__dirname, 'server', 'utils', 'print_raw.ps1');

function poll() {
    const client = serverUrl.startsWith('https') ? https : http;
    const urlObj = new URL(`${serverUrl}/api/config/printers/pending`);
    
    const req = client.get(urlObj, {
        headers: {
            'Cache-Control': 'no-cache'
        }
    }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode !== 200) {
                console.error(`[Print Agent] Servidor retornó estado ${res.statusCode}: ${data}`);
                setTimeout(poll, 3000);
                return;
            }
            
            try {
                const jobs = JSON.parse(data);
                if (jobs && jobs.length > 0) {
                    console.log(`[Print Agent] Recibidos ${jobs.length} trabajos de impresión.`);
                    processJobs(jobs);
                } else {
                    // Poll again in 1 second
                    setTimeout(poll, 1000);
                }
            } catch (err) {
                console.error(`[Print Agent] Error al decodificar JSON:`, err.message);
                setTimeout(poll, 3000);
            }
        });
    });
    
    req.on('error', (err) => {
        console.error(`[Print Agent] Error de conexión con el servidor (${err.message}). Reintentando en 3s...`);
        setTimeout(poll, 3000);
    });
}

function processJobs(jobs) {
    if (jobs.length === 0) {
        poll();
        return;
    }
    
    const job = jobs.shift();
    const printerConfig = job.printerConfig || {};
    console.log(`[Print Agent] [%s] Procesando impresión para ${printerConfig.type.toUpperCase()}...`, new Date().toLocaleTimeString());
    
    const args = [
        '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath,
        '-PrinterType', printerConfig.type || 'disabled',
        '-PrinterPath', printerConfig.path || '',
        '-PrinterName', printerConfig.printerName || '',
        '-HexData', job.hexData
    ];

    execFile('powershell.exe', args, (error, stdout, stderr) => {
        if (error) {
            console.error(`[Print Agent] Error al imprimir Trabajo #${job.id}:`, error.message);
            if (stderr) console.error(`[Print Agent] Detalle:`, stderr);
        } else {
            console.log(`[Print Agent] Trabajo #${job.id} impreso con éxito.`);
            if (stdout) {
                const cleanOut = stdout.replace(/[\r\n]+/g, ' ').trim();
                console.log(`[Print Agent] Info: ${cleanOut}`);
            }
        }
        
        // Process next job after small delay to let spooler relax
        setTimeout(() => processJobs(jobs), 200);
    });
}

// Start polling loop
poll();
