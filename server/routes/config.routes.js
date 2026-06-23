const express = require('express');
const router = express.Router();
const { RestaurantConfig, Setting } = require('../models');
const { EscPosBuilder, sendToPrinter, getPendingJobs, getPendingJobsForPrinters } = require('../utils/printer');

const LATEST_AGENT_VERSION = "1.0.0";

// Get generic restaurant config
router.get('/config', async (req, res) => {
    try {
        const envName = process.env.RESTAURANT_NAME;
        const config = await RestaurantConfig.findOne();

        const responseData = config ? config.toJSON() : { name: 'Restaurante', address: '' };
        if (envName) responseData.name = envName;

        res.json(responseData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update generic config
router.put('/config', async (req, res) => {
    try {
        const { name, address } = req.body;
        const config = await RestaurantConfig.findOne();
        if (config) {
            config.name = name;
            config.address = address;
            await config.save();
        } else {
            await RestaurantConfig.create({ name, address });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET printer settings
router.get('/config/printers', async (req, res) => {
    try {
        const setting = await Setting.findByPk('printer_config');
        if (setting) {
            return res.json(JSON.parse(setting.value));
        }
        
        // Return default empty config
        const defaultConfig = {
            caja: { type: 'disabled', path: '', printerName: '' },
            cocina: { type: 'disabled', path: '', printerName: '' },
            barra: { type: 'disabled', path: '', printerName: '' }
        };
        res.json(defaultConfig);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST update printer settings
router.post('/config/printers', async (req, res) => {
    try {
        const config = req.body;
        
        await Setting.upsert({
            key: 'printer_config',
            value: JSON.stringify(config),
            description: 'Thermal printer configuration (Caja, Cocina, Barra)'
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST test printer
router.post('/config/printers/test', async (req, res) => {
    try {
        const { printerKey, type, path, printerName } = req.body;
        
        if (!type || type === 'disabled') {
            return res.status(400).json({ error: 'La impresora esta deshabilitada. Activala primero.' });
        }

        // Build a nice test ticket (no kickDrawer — impresoras sin gaveta lo ignoran o bloquean)
        const builder = new EscPosBuilder().init();
        builder.alignCenter().doubleSize().bold().line("PRUEBA DE IMPRESION").doubleSize(false).bold(false).feed(1);
        builder.alignLeft();
        builder.line(`Impresora: ${printerKey.toUpperCase()}`);
        builder.line(`Tipo de Puerto: ${type}`);
        if (type === 'usb') {
            builder.line(`USB Path: ${path}`);
        } else if (type === 'ethernet') {
            builder.line(`IP Impresora: ${path}`);
        } else {
            builder.line(`Nombre Windows: ${printerName}`);
        }
        builder.line(`Fecha de Prueba: ${new Date().toLocaleString('es-PE')}`);
        builder.line("-".repeat(42));
        builder.bold().line("SI PUEDES LEER ESTO, LA IMPRESION").line("HA SIDO CONFIGURADA CORRECTAMENTE!").bold(false);
        builder.line("-".repeat(42)).feed(4).cut();

        const config = { type, path, printerName };
        const result = await sendToPrinter(printerKey, config, builder.toHex());

        if (result.success) {
            res.json({ success: true, message: 'Prueba enviada con exito!' });
        } else {
            res.status(500).json({ error: 'Fallo el envio a la impresora.', details: result.error || result.stderr });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET pending print jobs for local print agent
router.get('/config/printers/pending', (req, res) => {
    try {
        const { printers, agentId } = req.query;
        let jobs;
        if (printers) {
            const keys = printers.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
            jobs = getPendingJobsForPrinters(keys, agentId);
        } else {
            jobs = getPendingJobs(agentId);
        }
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET list of Windows printers installed on the server machine
// On Linux (VPS/Docker), returns [] — the local print agent should call this directly
router.get('/config/printers/windows-list', (req, res) => {
    const { execFile } = require('child_process');
    const isWindows = process.platform === 'win32';
    if (!isWindows) {
        return res.json([]);
    }
    execFile('powershell.exe', ['-NoProfile', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json'], { timeout: 8000 }, (err, stdout) => {
        if (err || !stdout.trim()) return res.json([]);
        try {
            const parsed = JSON.parse(stdout.trim());
            const names = Array.isArray(parsed) ? parsed : [parsed];
            res.json(names);
        } catch (_) {
            res.json([]);
        }
    });
});

// GET download the print agent installer script (instalar_servicio_impresion.ps1)
router.get('/config/printers/agent-download', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const scriptPath = path.resolve(__dirname, '../../instalar_servicio_impresion.ps1');
    if (!fs.existsSync(scriptPath)) {
        return res.status(404).json({ error: 'Script de instalacion no encontrado en el servidor.' });
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="instalar_servicio_impresion.ps1"');
    fs.createReadStream(scriptPath).pipe(res);
});

// GET download the graphical agent installer (MakalaAgentSetup.exe)
router.get('/config/printers/agent-setup-exe', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const exePath = path.resolve(__dirname, '../bin/MakalaAgentSetup.exe');
    if (!fs.existsSync(exePath)) {
        return res.status(404).json({ error: 'Instalador .exe no encontrado en el servidor.' });
    }
    res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
    res.setHeader('Content-Disposition', 'attachment; filename="MakalaAgentSetup.exe"');
    fs.createReadStream(exePath).pipe(res);
});

// GET download print-agent.js (el agente en sí, para instalación automática en nuevas PCs)
router.get('/config/printers/agent-js', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(__dirname, '../../print-agent.js');
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'print-agent.js no encontrado en el servidor.' });
    }
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Content-Disposition', 'attachment; filename="print-agent.js"');
    fs.createReadStream(filePath).pipe(res);
});

// GET download print_raw.ps1 (script auxiliar de impresion directa)
router.get('/config/printers/print-raw-ps1', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(__dirname, '../utils/print_raw.ps1');
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'print_raw.ps1 no encontrado en el servidor.' });
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="print_raw.ps1"');
    fs.createReadStream(filePath).pipe(res);
});

// Variable global efímera para rastrear múltiples agentes
global.connectedAgents = global.connectedAgents || {};

// POST ping from local print agent
router.post('/config/printers/agent-ping', (req, res) => {
    try {
        const { agent, agentId, version, printers } = req.body;
        if (agent === 'RestauranteAgentePrint') {
            const id = agentId || 'Agente-Desconocido';
            global.connectedAgents[id] = {
                lastSeen: Date.now(),
                version: version || '0.0.0',
                printers: Array.isArray(printers) ? printers : []
            };
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Agente no reconocido.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET status for frontend dashboard
router.get('/config/printers/agent-status', (req, res) => {
    try {
        const now = Date.now();
        const activeAgents = [];
        
        // Filtrar agentes que hicieron ping en los ultimos 15 segundos
        Object.keys(global.connectedAgents).forEach(id => {
            if ((now - global.connectedAgents[id].lastSeen) < 15000) {
                activeAgents.push({
                    agentId: id,
                    version: global.connectedAgents[id].version,
                    printers: global.connectedAgents[id].printers
                });
            } else {
                // Clean up dead agents
                delete global.connectedAgents[id];
            }
        });

        res.json({
            active: activeAgents.length > 0,
            agents: activeAgents,
            latestVersion: LATEST_AGENT_VERSION
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
