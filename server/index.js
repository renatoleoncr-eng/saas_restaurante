// Main Server Entry Point — Multi-SaaS
// Trigger Restart: 9
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

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

const { Reservation } = require('./models');
const { Op } = require('sequelize');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

app.use(cors());
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
// PUBLIC ROUTES (No tenant or auth required)
// =============================================
app.use('/api', authRoutes);                          // POST /api/login, POST /api/auth/refresh, GET /api/auth/me
app.use('/api/tenants', tenantRoutes);                // POST /api/tenants/register, GET /api/tenants/check-slug/:slug

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'Gestion Restaurante SaaS' }));

// =============================================
// TENANT-SCOPED ROUTES (require valid tenant)
// =============================================
// All routes below require a valid tenant context (subdomain).
// Auth is handled per-route or could be added as a second middleware layer.
app.use('/api', requireTenant, layoutRoutes);
app.use('/api', requireTenant, configRoutes);
app.use('/api', requireTenant, billingRoutes);
app.use('/api', requireTenant, operationRoutes);
app.use('/api', requireTenant, productRoutes);
app.use('/api', requireTenant, attendanceRoutes);
app.use('/api', requireTenant, userRoutes);
app.use('/api/reservations', requireTenant, reservationRoutes);
app.use('/api/stock', requireTenant, recipeRoutes);
app.use('/api', requireTenant, auditRoutes);
app.use('/api', requireTenant, menuRoutes);
app.use('/api', requireTenant, expenseRoutes);
app.use('/api', requireTenant, accountRoutes);
app.use('/api', requireTenant, drinkPromotionRoutes);
app.use('/api', requireTenant, sessionRoutes);
app.use('/api', requireTenant, revenueRoutes);
app.use('/api/qrs', requireTenant, qrRoutes);
app.use('/api/promotions', requireTenant, promotionRoutes);
app.use('/api/roulette', requireTenant, rouletteRoutes);

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
