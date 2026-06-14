const express = require('express');
const router = express.Router();
const { RestaurantConfig, Setting } = require('../models');
const { EscPosBuilder, sendToPrinter, getPendingJobs, getPendingJobsForPrinters } = require('../utils/printer');

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
        const { printers } = req.query;
        let jobs;
        if (printers) {
            const keys = printers.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
            jobs = getPendingJobsForPrinters(keys);
        } else {
            jobs = getPendingJobs();
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

module.exports = router;

