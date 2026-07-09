const { AuditLog } = require('../models');

/**
 * Logs a user action to the database.
 * @param {Object} req - Express request object (to extract user and IP)
 * @param {string} action - Action name (e.g., 'LOGIN', 'CREATE')
 * @param {string} entity - Entity name (e.g., 'User', 'Product')
 * @param {number|string} entityId - ID of the affected entity
 * @param {Object|string} details - Additional details (will be JSON stringified)
 */
async function logAction(req, action, entity, entityId, details = null) {
    try {
        const userId = req.user ? req.user.id : (req.body?.userId || req.query?.userId || null); // Try to get from auth middleware, body, or query params
        const ipAddress = req.ip || req.connection.remoteAddress;

        // Ensure details is a string if it's an object, or null
        let detailsStr = details;
        if (typeof details === 'object' && details !== null) {
            detailsStr = JSON.stringify(details);
        }

        await AuditLog.create({
            UserId: userId,
            action,
            entity,
            entityId: String(entityId),
            details: detailsStr,
            ipAddress,
            TenantId: req.tenant ? req.tenant.id : null
        });
    } catch (err) {
        console.error("Failed to write audit log:", err);
        // Don't crash the request if logging fails
    }
}

module.exports = { logAction };
