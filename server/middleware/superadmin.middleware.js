/**
 * Super Admin Middleware
 * Handles platform-level authentication (not tenant-scoped).
 * Uses SAAS_API_KEY from environment to issue superadmin JWTs.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_restaurante_prod';
const SAAS_API_KEY = process.env.SAAS_API_KEY || 'mak_secure_auth_k3y_928374';

/**
 * Generate a superadmin JWT (no tenantId — platform-level access).
 */
function generateSuperAdminToken() {
    return jwt.sign(
        {
            role: 'superadmin',
            username: 'superadmin',
            type: 'superadmin'
        },
        JWT_SECRET,
        { expiresIn: '12h' }
    );
}

/**
 * Middleware: verify that the request carries a valid superadmin JWT.
 * Usage: router.get('/protected', requireSuperAdmin, handler)
 */
function requireSuperAdmin(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Autenticación de Super Admin requerida' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (decoded.role !== 'superadmin' || decoded.type !== 'superadmin') {
            return res.status(403).json({ error: 'Acceso denegado: se requiere rol Super Admin' });
        }

        req.superAdmin = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Sesión expirada', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ error: 'Token inválido' });
    }
}

/**
 * Validate API key against SAAS_API_KEY env variable.
 */
function validateApiKey(apiKey) {
    return apiKey && apiKey === SAAS_API_KEY;
}

module.exports = { generateSuperAdminToken, requireSuperAdmin, validateApiKey };
