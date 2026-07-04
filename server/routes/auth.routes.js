const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { User, Tenant } = require('../models');
const { logAction } = require('../utils/audit');
const { generateToken, generateRefreshToken, JWT_SECRET } = require('../middleware/auth.middleware');
const jwt = require('jsonwebtoken');

// =============================================
// LOGIN (Tenant-Scoped)
// =============================================
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
        }

        // Build query — if tenant context exists, scope to tenant
        const where = { username };
        if (req.tenant) {
            where.TenantId = req.tenant.id;
        }

        const user = await User.findOne({ where });

        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Support both bcrypt hashed and legacy plain-text passwords
        let passwordMatch = false;
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
            // Bcrypt hash
            passwordMatch = await bcrypt.compare(password, user.password);
        } else {
            // Legacy plain-text comparison (will be migrated)
            passwordMatch = (user.password === password);
            // Auto-upgrade to bcrypt on successful plain-text login
            if (passwordMatch) {
                const hashed = await bcrypt.hash(password, 10);
                await user.update({ password: hashed });
                console.log(`[Auth] Auto-upgraded password hash for user: ${username}`);
            }
        }

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        if (user.active === false) {
            return res.status(401).json({ error: 'Usuario desactivado. Contacte al administrador.' });
        }

        const tenantId = user.TenantId;

        // Generate JWT tokens
        const token = generateToken(user, tenantId);
        const refreshToken = generateRefreshToken(user, tenantId);

        // Log Login
        req.user = user;
        await logAction(req, 'LOGIN', 'User', user.id, { username });

        // Return user info + tokens
        res.json({
            token,
            refreshToken,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                displayName: user.displayName,
                requirePinPrompt: user.requirePinPrompt,
                pin: user.pin
            }
        });

    } catch (err) {
        console.error('[Auth] Login error:', err);
        res.status(500).json({ error: err.message });
    }
});

// =============================================
// REFRESH TOKEN
// =============================================
router.post('/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token requerido' });
        }

        const decoded = jwt.verify(refreshToken, JWT_SECRET);

        if (decoded.type !== 'refresh') {
            return res.status(401).json({ error: 'Token inválido' });
        }

        const user = await User.findByPk(decoded.id);
        if (!user || !user.active) {
            return res.status(401).json({ error: 'Usuario no encontrado o desactivado' });
        }

        const newToken = generateToken(user, decoded.tenantId);
        const newRefreshToken = generateRefreshToken(user, decoded.tenantId);

        res.json({
            token: newToken,
            refreshToken: newRefreshToken
        });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Refresh token expirado. Inicie sesión nuevamente.', code: 'REFRESH_EXPIRED' });
        }
        res.status(401).json({ error: 'Token inválido' });
    }
});

// =============================================
// GET CURRENT USER (from JWT)
// =============================================
router.get('/auth/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findByPk(decoded.id, {
            attributes: ['id', 'username', 'role', 'displayName', 'requirePinPrompt', 'pin', 'email', 'active']
        });

        if (!user || !user.active) {
            return res.status(401).json({ error: 'Usuario no encontrado o desactivado' });
        }

        // Get tenant info
        let tenant = null;
        if (decoded.tenantId) {
            tenant = await Tenant.findByPk(decoded.tenantId, {
                attributes: ['id', 'name', 'slug', 'plan', 'status', 'logoUrl']
            });
        }

        res.json({ user, tenant });
    } catch (err) {
        res.status(401).json({ error: 'Token inválido' });
    }
});

module.exports = router;
