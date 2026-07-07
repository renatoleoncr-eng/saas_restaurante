const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_restaurante_prod';

/**
 * Auth middleware — verifies JWT token from Authorization header.
 * Attaches decoded user to req.user.
 * Also verifies user belongs to the current tenant (req.tenant).
 */
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticación requerido' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Verify user still exists in DB and is active
        const { User } = require('../models');
        const user = await User.findByPk(decoded.id);
        
        if (!user || !user.active) {
            return res.status(401).json({ error: 'Sesión inválida o expirada', code: 'TOKEN_EXPIRED' });
        }

        // Verify user belongs to current tenant
        if (req.tenant && decoded.tenantId !== req.tenant.id) {
            return res.status(403).json({ error: 'No tienes acceso a este restaurante' });
        }

        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ error: 'Token inválido' });
    }
}

/**
 * Optional auth — doesn't block if no token, but attaches user if valid.
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
    } catch (err) {
        // Ignore invalid tokens in optional auth
    }

    next();
}

/**
 * Role-based authorization middleware.
 * Usage: router.get('/admin-only', requireRole('admin'), handler)
 * Usage: router.get('/staff', requireRole('admin', 'cashier'), handler)
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Autenticación requerida' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'No tienes permisos para esta acción' });
        }
        next();
    };
}

/**
 * Generate JWT token for a user.
 */
function generateToken(user, tenantId) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            role: user.role,
            displayName: user.displayName,
            tenantId: tenantId,
            requirePinPrompt: user.requirePinPrompt,
            pin: user.pin
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

/**
 * Generate a refresh token (longer lived).
 */
function generateRefreshToken(user, tenantId) {
    return jwt.sign(
        {
            id: user.id,
            tenantId: tenantId,
            type: 'refresh'
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

module.exports = { authMiddleware, optionalAuth, requireRole, generateToken, generateRefreshToken, JWT_SECRET };
