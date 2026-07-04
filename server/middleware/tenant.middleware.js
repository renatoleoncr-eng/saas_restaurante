/**
 * Tenant Resolution Middleware
 * 
 * Extracts the tenant from the request based on:
 * 1. Subdomain (e.g., pepitos.maksuites.com.pe → slug = 'pepitos')
 * 2. X-Tenant-Slug header (for dev/testing)
 * 3. Query param ?tenant=slug (for dev/testing)
 * 
 * Attaches req.tenant with the full tenant object.
 */

const MAIN_DOMAINS = (process.env.MAIN_DOMAIN || 'maksuites.com.pe,localhost').split(',').map(d => d.trim());

function extractSlugFromHost(host) {
    // Remove port if present
    const hostname = host.split(':')[0];

    // Check if it's a subdomain of any main domain
    for (const mainDomain of MAIN_DOMAINS) {
        if (mainDomain === 'localhost' || mainDomain === '127.0.0.1') {
            continue; // Can't extract subdomain from localhost
        }
        if (hostname.endsWith('.' + mainDomain)) {
            const slug = hostname.replace('.' + mainDomain, '');
            // Ensure it's a single level subdomain (no dots)
            if (slug && !slug.includes('.')) {
                return slug;
            }
        }
    }

    return null;
}

/**
 * Main tenant middleware — resolves tenant from request.
 * Must be applied BEFORE auth middleware.
 */
function tenantMiddleware(Tenant) {
    return async (req, res, next) => {
        try {
            // Try to extract slug from various sources
            let slug = null;

            // 1. From subdomain
            const host = req.headers.host || '';
            slug = extractSlugFromHost(host);

            // 2. From header (dev/testing override)
            if (!slug && req.headers['x-tenant-slug']) {
                slug = req.headers['x-tenant-slug'];
            }

            // 3. From query param (dev/testing)
            if (!slug && req.query.tenant) {
                slug = req.query.tenant;
            }

            if (!slug) {
                // No tenant detected — this is OK for public/landing routes
                req.tenant = null;
                return next();
            }

            // Look up the tenant
            const tenant = await Tenant.findOne({
                where: { slug, status: 'active' }
            });

            if (!tenant) {
                return res.status(404).json({
                    error: 'Restaurante no encontrado',
                    code: 'TENANT_NOT_FOUND'
                });
            }

            req.tenant = tenant;
            next();
        } catch (err) {
            console.error('[Tenant Middleware] Error:', err);
            res.status(500).json({ error: 'Error resolviendo restaurante' });
        }
    };
}

/**
 * Require tenant middleware — blocks requests without a valid tenant.
 * Use this for tenant-scoped API routes.
 */
function requireTenant(req, res, next) {
    if (!req.tenant) {
        return res.status(400).json({
            error: 'Se requiere un restaurante válido. Accede desde tu subdominio.',
            code: 'TENANT_REQUIRED'
        });
    }
    next();
}

module.exports = { tenantMiddleware, requireTenant, extractSlugFromHost };
