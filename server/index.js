// Main Server Entry Point
// Trigger Restart: 8
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const syncDB = require('./sync');
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

// Live State for Client Screen (to sync reconnected clients)
let currentClientScreenMode = 'ads';

// Log when a client connects
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    // Sync current screen mode to the newly connected client immediately
    socket.emit('update_client_screen_mode', { mode: currentClientScreenMode });

    socket.on('trigger_qr_display', () => {
        io.emit('show_qr_display');
    });
    socket.on('set_client_screen_mode', (data) => {
        console.log('Setting client screen mode:', data.mode);
        currentClientScreenMode = data.mode; // Persist state
        io.emit('update_client_screen_mode', { mode: data.mode });
    });
    socket.on('notify_promotions_updated', () => {
        console.log('Promotions updated, broadcasting...');
        io.emit('promotions_updated');
    });
    socket.on('start_projection', (data) => {
        console.log('Starting projection:', data.promoId);
        io.emit('client_start_projection', data);
    });
    socket.on('stop_projection', () => {
        console.log('Stopping projection');
        io.emit('client_stop_projection');
    });
    socket.on('report_roulette_winner', (data) => {
        console.log('Roulette winner reported:', data.winnerName);
        io.emit('roulette_finished_with_winner', data);
    });
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Wire Global Internal Emitter
const appEmitter = require('./utils/emitter');
appEmitter.on('qr_config_changed', () => {
    io.emit('qr_config_changed');
    io.emit('check_active_qr');
});
appEmitter.on('promotions_config_changed', () => {
    io.emit('promotions_updated');
});
appEmitter.on('check_active_qr', () => {
    io.emit('check_active_qr');
});

// Serve uploads folder publicly
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', authRoutes);
app.use('/api', layoutRoutes);
app.use('/api', configRoutes);
app.use('/api', billingRoutes);
app.use('/api', operationRoutes);
app.use('/api', productRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', userRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/stock', recipeRoutes); // Use /api/stock base for recipe/ingredient routes
app.use('/api', auditRoutes);
app.use('/api', menuRoutes);
app.use('/api', expenseRoutes);
app.use('/api', accountRoutes);
app.use('/api', drinkPromotionRoutes);
app.use('/api', sessionRoutes);
app.use('/api', revenueRoutes);
app.use('/api/qrs', qrRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/roulette', rouletteRoutes);


app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'Gestion Restaurante' }));

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
app.use(express.static(path.join(__dirname, '../client/dist')));

// Fallback for SPA
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ message: 'API Not Found' });
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
