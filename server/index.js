// Main Server Entry Point — Multi-SaaS
// Trigger Restart: 9
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// =============================================
// FAIL-FAST: Variables de entorno requeridas
// =============================================
const requiredEnv = ['JWT_SECRET', 'SAAS_API_KEY'];
const missingEnv = requiredEnv.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
    console.error(`\u274C FATAL: Variables de entorno requeridas no definidas: ${missingEnv.join(', ')}`);
    console.error('Asegúrate de que el archivo .env esté configurado en el servidor.');
    process.exit(1);
}

const syncDB = require('./sync');
const { Tenant } = require('./models');

// Middleware
const { tenantMiddleware, requireTenant } = require('./middleware/tenant.middleware');
const { authMiddleware, optionalAuth } = require('./middleware/auth.middleware');

// Routes
const layoutRoutes = require('./routes/layout.routes');
const configRoutes = require('./routes/config.routes');
const authRoutes = require('./routes/auth.routes');
const operationRoutes = require('./routes/operation.routes');
const productRoutes = require('./routes/product.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const userRoutes = require('./routes/user.routes');
const reservationRoutes = require('./routes/reservation.routes');
const recipeRoutes = require('./routes/recipe.routes');
const auditRoutes = require('./routes/audit.routes');
const menuRoutes = require('./routes/menu.routes');
const expenseRoutes = require('./routes/expense.routes');
const accountRoutes = require('./routes/account.routes');
const drinkPromotionRoutes = require('./routes/drink-promotions.routes');
const sessionRoutes = require('./routes/session.routes');
const revenueRoutes = require('./routes/revenue.routes');
const billingRoutes = require('./routes/billing.routes');
const qrRoutes = require('./routes/qr.routes');
const promotionRoutes = require('./routes/promotion.routes');
const rouletteRoutes = require('./routes/roulette.routes');
const tenantRoutes = require('./routes/tenant.routes');
const superadminRoutes = require('./routes/superadmin.routes');

// Router para rutas del agente de impresion (sin auth de usuario — proceso de sistema)
const express_inner = require('express');
const printerAgentRouter = express_inner.Router();
const { getPendingJobs, getPendingJobsForPrinters, ackPrintJob, cleanupOldPrintJobs, printEvent } = require('./utils/printer');

const LATEST_AGENT_VERSION_INDEX = (() => {
    try {
        const fs = require('fs');
        const content = fs.readFileSync(require('path').join(__dirname, '../print-agent.js'), 'utf8');
        const match = content.match(/AGENT_VERSION\s*=\s*["']([^"']+)["']/);
        return match ? match[1] : '1.0.0';
    } catch (_) { return '1.0.0'; }
})();

global.connectedAgents = global.connectedAgents || {};

printerAgentRouter.post('/config/printers/agent-ping', (req, res) => {
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

// GET pending print jobs — long-polling, DB-backed (identico al original en config.routes.js)
printerAgentRouter.get('/config/printers/pending', async (req, res) => {
    try {
        const { printers, agentId } = req.query;
        let keys = null;
        if (printers) {
            keys = printers.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
        }

        const fetchJobs = async () => {
            if (keys && keys.length > 0) return getPendingJobsForPrinters(keys, agentId);
            return getPendingJobs(agentId);
        };

        // Intento inmediato en DB
        let jobs = await fetchJobs();
        if (jobs && jobs.length > 0) {
            return res.json(jobs);
        }

        // Long-polling: espera hasta 8s por un nuevo job
        const onNewJob = async () => {
            try {
                jobs = await fetchJobs();
                if (jobs && jobs.length > 0) {
                    clearTimeout(timeoutId);
                    printEvent.removeListener('new_job', onNewJob);
                    if (!res.headersSent) res.json(jobs);
                }
            } catch (_) {}
        };

        const timeoutId = setTimeout(() => {
            printEvent.removeListener('new_job', onNewJob);
            if (!res.headersSent) res.json([]);
        }, 8000);

        printEvent.on('new_job', onNewJob);

        req.on('close', () => {
            clearTimeout(timeoutId);
            printEvent.removeListener('new_job', onNewJob);
        });

    } catch (err) {
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

// POST ack — el agente llama /api/config/printers/jobs/:id/ack (con el ID en la URL)
printerAgentRouter.post('/config/printers/jobs/:id/ack', async (req, res) => {
    try {
        const { id } = req.params;
        const { success, error: errorMsg } = req.body;
        await ackPrintJob(parseInt(id, 10), success !== false, errorMsg);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET descargar instalador del agente (.exe) — ruta pública: el navegador no envía JWT en links de descarga
printerAgentRouter.get('/config/printers/agent-setup-exe', (req, res) => {
    const fs = require('fs');
    const filePath = require('path').resolve(__dirname, 'bin/MakalaAgentSetup.exe');
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Instalador no encontrado en el servidor.' });
    }
    res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
    res.setHeader('Content-Disposition', 'attachment; filename="MakalaAgentSetup.exe"');
    fs.createReadStream(filePath).pipe(res);
});

// GET descargar print-agent.js — ruta pública
printerAgentRouter.get('/config/printers/agent-js', (req, res) => {
    const fs = require('fs');
    const filePath = require('path').resolve(__dirname, '../print-agent.js');
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'print-agent.js no encontrado.' });
    }
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Content-Disposition', 'attachment; filename="print-agent.js"');
    fs.createReadStream(filePath).pipe(res);
});

// GET descargar script PowerShell instalador — ruta pública
printerAgentRouter.get('/config/printers/agent-download', (req, res) => {
    const fs = require('fs');
    const filePath = require('path').resolve(__dirname, '../instalar_servicio_impresion.ps1');
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Script de instalacion no encontrado.' });
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="instalar_servicio_impresion.ps1"');
    fs.createReadStream(filePath).pipe(res);
});


const { Reservation } = require('./models');
const { Op } = require('sequelize');

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : null;

const corsOptions = {
    origin: (origin, callback) => {
        // Peticiones sin origin (cURL, mobile apps, agente de impresión o mismo servidor)
        if (!origin) return callback(null, true);

        if (allowedOrigins) {
            if (allowedOrigins.indexOf(origin) !== -1) {
                return callback(null, true);
            }
        } else {
            // Por defecto: permitir localhost y subdominios de maksuites.com.pe
            if (
                /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
                /^https?:\/\/([a-z0-9-]+\.)?maksuites\.com\.pe$/.test(origin)
            ) {
                return callback(null, true);
            }
        }
        callback(new Error('No permitido por la política CORS'));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: corsOptions
});

app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());

// Share io instance
app.set('io', io);

// =============================================
// GLOBAL MIDDLEWARE: Tenant Resolution
// =============================================
// Resolves tenant from subdomain on ALL requests.
// req.tenant will be null for main domain (landing page).
app.use(tenantMiddleware(Tenant));

// Live State for Client Screen (per tenant, keyed by tenantId)
const clientScreenModes = {};

// Log when a client connects
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Join tenant room if tenant info is provided
    socket.on('join_tenant', (tenantId) => {
        if (tenantId) {
            socket.join(`tenant_${tenantId}`);
            console.log(`Socket ${socket.id} joined tenant_${tenantId}`);
            // Sync current screen mode
            const mode = clientScreenModes[tenantId] || 'ads';
            socket.emit('update_client_screen_mode', { mode });
        }
    });

    socket.on('trigger_qr_display', (data) => {
        const tenantId = data?.tenantId;
        if (tenantId) {
            io.to(`tenant_${tenantId}`).emit('show_qr_display');
        } else {
            io.emit('show_qr_display');
        }
    });
    socket.on('set_client_screen_mode', (data) => {
        console.log('Setting client screen mode:', data.mode);
        const tenantId = data?.tenantId;
        if (tenantId) {
            clientScreenModes[tenantId] = data.mode;
            io.to(`tenant_${tenantId}`).emit('update_client_screen_mode', { mode: data.mode });
        } else {
            io.emit('update_client_screen_mode', { mode: data.mode });
        }
    });
    socket.on('notify_promotions_updated', (data) => {
        console.log('Promotions updated, broadcasting...');
        const tenantId = data?.tenantId;
        if (tenantId) {
            io.to(`tenant_${tenantId}`).emit('promotions_updated');
        } else {
            io.emit('promotions_updated');
        }
    });
    socket.on('start_projection', (data) => {
        console.log('Starting projection:', data.promoId);
        const tenantId = data?.tenantId;
        if (tenantId) {
            io.to(`tenant_${tenantId}`).emit('client_start_projection', data);
        } else {
            io.emit('client_start_projection', data);
        }
    });
    socket.on('stop_projection', (data) => {
        console.log('Stopping projection');
        const tenantId = data?.tenantId;
        if (tenantId) {
            io.to(`tenant_${tenantId}`).emit('client_stop_projection');
        } else {
            io.emit('client_stop_projection');
        }
    });
    socket.on('report_roulette_winner', (data) => {
        console.log('Roulette winner reported:', data.winnerName);
        const tenantId = data?.tenantId;
        if (tenantId) {
            io.to(`tenant_${tenantId}`).emit('roulette_finished_with_winner', data);
        } else {
            io.emit('roulette_finished_with_winner', data);
        }
    });
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Wire Global Internal Emitter
const appEmitter = require('./utils/emitter');
appEmitter.on('qr_config_changed', (tenantId) => {
    if (tenantId) {
        io.to(`tenant_${tenantId}`).emit('qr_config_changed');
        io.to(`tenant_${tenantId}`).emit('check_active_qr');
    } else {
        io.emit('qr_config_changed');
        io.emit('check_active_qr');
    }
});
appEmitter.on('promotions_config_changed', (tenantId) => {
    if (tenantId) {
        io.to(`tenant_${tenantId}`).emit('promotions_updated');
    } else {
        io.emit('promotions_updated');
    }
});
appEmitter.on('check_active_qr', (tenantId) => {
    if (tenantId) {
        io.to(`tenant_${tenantId}`).emit('check_active_qr');
    } else {
        io.emit('check_active_qr');
    }
});

// Serve uploads folder publicly
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// =============================================
// RUTAS PÚBLICAS (No requieren tenant ni auth)
// =============================================
app.use('/api', authRoutes);                          // POST /api/login, POST /api/auth/refresh, GET /api/auth/me
app.use('/api/tenants', tenantRoutes);                // POST /api/tenants/register, GET /api/tenants/check-slug/:slug
app.use('/api/superadmin', superadminRoutes);         // POST /api/superadmin/login, tenant management (no requireTenant)

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'Gestion Restaurante SaaS' }));

// =============================================
// RUTAS DE TENANT PÚBLICAS (tenant requerido, sin auth)
// Pantalla cliente, menú, layout de mesas, agente de impresión
// =============================================
app.use('/api', requireTenant, layoutRoutes);         // layout de mesas — pantalla pública del restaurante
app.use('/api', requireTenant, menuRoutes);           // menú digital — puede ser pública
app.use('/api/qrs', requireTenant, qrRoutes);         // pantalla cliente QR — pública
app.use('/api/promotions', requireTenant, promotionRoutes); // promociones para pantalla cliente
app.use('/api/roulette', requireTenant, rouletteRoutes);    // ruleta para pantalla cliente
app.use('/api', requireTenant, printerAgentRouter);   // agente de impresión local (proceso sistema, sin auth de usuario)

// =============================================
// RUTAS PROTEGIDAS (tenant + auth JWT requeridos)
// =============================================
app.use('/api', requireTenant, authMiddleware, operationRoutes);       // cuentas, órdenes, stock
app.use('/api', requireTenant, authMiddleware, configRoutes);          // configuración del restaurante
app.use('/api', requireTenant, authMiddleware, billingRoutes);         // facturación SUNAT
app.use('/api', requireTenant, authMiddleware, productRoutes);         // productos e ingredientes
app.use('/api', requireTenant, authMiddleware, attendanceRoutes);      // asistencia
app.use('/api', requireTenant, authMiddleware, userRoutes);            // gestión de usuarios
app.use('/api/reservations', requireTenant, authMiddleware, reservationRoutes); // reservas
app.use('/api/stock', requireTenant, authMiddleware, recipeRoutes);   // recetas y stock
app.use('/api', requireTenant, authMiddleware, auditRoutes);          // auditoría
app.use('/api', requireTenant, authMiddleware, expenseRoutes);        // gastos
app.use('/api', requireTenant, authMiddleware, accountRoutes);        // cuentas
app.use('/api', requireTenant, authMiddleware, drinkPromotionRoutes); // promociones de bebidas
app.use('/api', requireTenant, authMiddleware, sessionRoutes);        // sesiones de caja
app.use('/api', requireTenant, authMiddleware, revenueRoutes);        // ingresos (también tiene apiKeyAuth)

// Reservation Auto-Release Logic (Run every minute)
setInterval(async () => {
    try {
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

        await Reservation.update(
            { status: 'no_show' },
            {
                where: {
                    status: 'pending', // or 'confirmed'
                    reservationTime: { [Op.lt]: thirtyMinsAgo }
                }
            }
        );
        // Note: Ideally emit socket event to update Frontend
    } catch (e) {
        console.error("Auto-release error:", e);
    }
}, 60000);

// Serve Frontend (Production)
app.use(express.static(path.join(__dirname, '../client/dist'), {
    setHeaders: (res, filepath) => {
        if (path.basename(filepath) === 'index.html') {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        }
    }
}));

// Fallback for SPA
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ message: 'API Not Found' });
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Start Server & Sync DB
const PORT = process.env.PORT || 3003;
// Wait for DB sync before starting server
syncDB().then(() => {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error("Failed to start server:", err);
});
