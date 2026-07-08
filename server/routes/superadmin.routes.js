/**
 * Super Admin Routes — Platform-level tenant management
 * Secured by requireSuperAdmin middleware (SAAS_API_KEY → JWT).
 * These routes bypass tenant resolution — they operate on ALL tenants.
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { generateSuperAdminToken, requireSuperAdmin, validateApiKey } = require('../middleware/superadmin.middleware');
const models = require('../models');
const {
    Tenant, User, RestaurantConfig, Area, Table, Account, Order,
    Product, ProductVariant, Ingredient, IngredientMovement, Recipe,
    AuditLog, DailyMenu, Expense, Payment, DrinkPromotion, DrinkPromotionItem,
    DrinkItemRecipe, CashSession, Attendance, Reservation, ProductMovement, sequelize
} = models;

// =============================================
// POST /api/superadmin/login
// =============================================
// Authenticate with SAAS_API_KEY → receive superadmin JWT
router.post('/login', (req, res) => {
    const { apiKey } = req.body;

    if (!apiKey) {
        return res.status(400).json({ error: 'API key requerida' });
    }

    if (!validateApiKey(apiKey)) {
        return res.status(401).json({ error: 'API key inválida' });
    }

    const token = generateSuperAdminToken();
    res.json({
        token,
        message: 'Autenticado como Super Admin',
        expiresIn: '12h'
    });
});

// =============================================
// GET /api/superadmin/tenants
// =============================================
// List all tenants with stats (orders count, users count, products count)
router.get('/tenants', requireSuperAdmin, async (req, res) => {
    try {
        const tenants = await Tenant.findAll({
            order: [['createdAt', 'DESC']]
        });

        const VALID_MODULES = ['moduloPromocionesHabilitado', 'moduloMenuHabilitado', 'moduloFacturacionHabilitado'];

        // Fetch stats for each tenant in parallel
        const tenantsWithStats = await Promise.all(tenants.map(async (tenant) => {
            const [orderCount, userCount, productCount, config] = await Promise.all([
                Order.count({ where: { TenantId: tenant.id } }),
                User.count({ where: { TenantId: tenant.id } }),
                Product.count({ where: { TenantId: tenant.id } }),
                RestaurantConfig.findOne({ where: { TenantId: tenant.id } })
            ]);

            // Parse settings to extract module flags
            let settings = {};
            try { settings = JSON.parse(tenant.settings || '{}'); } catch (e) { settings = {}; }
            const modules = VALID_MODULES.reduce((acc, key) => {
                acc[key] = settings[key] !== false;
                return acc;
            }, {});

            return {
                id: tenant.id,
                name: tenant.name,
                slug: tenant.slug,
                ownerEmail: tenant.ownerEmail,
                plan: tenant.plan,
                status: tenant.status,
                storageLimitMb: tenant.storageLimitMb,
                internalNotes: tenant.internalNotes,
                logoUrl: tenant.logoUrl,
                restaurantName: config?.name || tenant.name,
                createdAt: tenant.createdAt,
                updatedAt: tenant.updatedAt,
                modules,
                stats: {
                    orders: orderCount,
                    users: userCount,
                    products: productCount
                }
            };
        }));

        res.json({ tenants: tenantsWithStats, total: tenantsWithStats.length });
    } catch (err) {
        console.error('[SuperAdmin] Error listing tenants:', err);
        res.status(500).json({ error: 'Error obteniendo restaurantes' });
    }
});


// =============================================
// PUT /api/superadmin/tenants/:id/status
// =============================================
// Change tenant status: active ↔ suspended
router.put('/tenants/:id/status', requireSuperAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['active', 'suspended'].includes(status)) {
            return res.status(400).json({ error: 'Estado inválido. Use: active, suspended' });
        }

        const tenant = await Tenant.findByPk(req.params.id);
        if (!tenant) return res.status(404).json({ error: 'Restaurante no encontrado' });

        await tenant.update({ status });
        res.json({ message: `Estado actualizado a: ${status}`, tenant: { id: tenant.id, status } });
    } catch (err) {
        console.error('[SuperAdmin] Error updating status:', err);
        res.status(500).json({ error: 'Error actualizando estado' });
    }
});

// =============================================
// PUT /api/superadmin/tenants/:id/plan
// =============================================
// Change tenant plan: demo ↔ pago
router.put('/tenants/:id/plan', requireSuperAdmin, async (req, res) => {
    try {
        const { plan } = req.body;
        if (!['demo', 'pago'].includes(plan)) {
            return res.status(400).json({ error: 'Plan inválido. Use: demo, pago' });
        }

        const tenant = await Tenant.findByPk(req.params.id);
        if (!tenant) return res.status(404).json({ error: 'Restaurante no encontrado' });

        // Auto-adjust storage limit when plan changes
        const newStorageLimit = plan === 'pago' ? 500 : 50;
        await tenant.update({ plan, storageLimitMb: newStorageLimit });

        res.json({
            message: `Plan actualizado a: ${plan} (storage: ${newStorageLimit} MB)`,
            tenant: { id: tenant.id, plan, storageLimitMb: newStorageLimit }
        });
    } catch (err) {
        console.error('[SuperAdmin] Error updating plan:', err);
        res.status(500).json({ error: 'Error actualizando plan' });
    }
});

// =============================================
// PUT /api/superadmin/tenants/:id/storage
// =============================================
// Manually set storage limit in MB
router.put('/tenants/:id/storage', requireSuperAdmin, async (req, res) => {
    try {
        const { storageLimitMb } = req.body;
        const limit = parseInt(storageLimitMb);

        if (isNaN(limit) || limit < 1 || limit > 10000) {
            return res.status(400).json({ error: 'Límite inválido. Debe ser entre 1 y 10000 MB' });
        }

        const tenant = await Tenant.findByPk(req.params.id);
        if (!tenant) return res.status(404).json({ error: 'Restaurante no encontrado' });

        await tenant.update({ storageLimitMb: limit });
        res.json({ message: `Límite de almacenamiento: ${limit} MB`, tenant: { id: tenant.id, storageLimitMb: limit } });
    } catch (err) {
        console.error('[SuperAdmin] Error updating storage:', err);
        res.status(500).json({ error: 'Error actualizando almacenamiento' });
    }
});

// =============================================
// PUT /api/superadmin/tenants/:id/notes
// =============================================
// Save internal notes for a tenant (only visible to super admin)
router.put('/tenants/:id/notes', requireSuperAdmin, async (req, res) => {
    try {
        const { internalNotes } = req.body;

        const tenant = await Tenant.findByPk(req.params.id);
        if (!tenant) return res.status(404).json({ error: 'Restaurante no encontrado' });

        await tenant.update({ internalNotes: internalNotes || null });
        res.json({ message: 'Notas actualizadas', tenant: { id: tenant.id, internalNotes } });
    } catch (err) {
        console.error('[SuperAdmin] Error updating notes:', err);
        res.status(500).json({ error: 'Error actualizando notas' });
    }
});

// =============================================
// POST /api/superadmin/tenants/:id/reset-admin-password
// =============================================
// Reset the 'admin' user password for a tenant
router.post('/tenants/:id/reset-admin-password', requireSuperAdmin, async (req, res) => {
    try {
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
        }

        const tenant = await Tenant.findByPk(req.params.id);
        if (!tenant) return res.status(404).json({ error: 'Restaurante no encontrado' });

        const adminUser = await User.findOne({
            where: { TenantId: tenant.id, username: 'admin' }
        });

        if (!adminUser) {
            return res.status(404).json({ error: 'Usuario admin no encontrado para este restaurante' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await adminUser.update({ password: hashedPassword });

        res.json({
            message: `Contraseña del admin reseteada para: ${tenant.name} (${tenant.slug})`,
            tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name }
        });
    } catch (err) {
        console.error('[SuperAdmin] Error resetting password:', err);
        res.status(500).json({ error: 'Error reseteando contraseña' });
    }
});

// =============================================
// DELETE /api/superadmin/tenants/:id
// =============================================
// Delete a tenant and ALL its data in cascade
router.delete('/tenants/:id', requireSuperAdmin, async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const tenant = await Tenant.findByPk(req.params.id);
        if (!tenant) {
            await t.rollback();
            return res.status(404).json({ error: 'Restaurante no encontrado' });
        }

        // Safety: never delete the default 'makala' tenant
        if (tenant.slug === 'makala') {
            await t.rollback();
            return res.status(403).json({ error: 'No se puede eliminar el tenant principal (makala)' });
        }

        const tenantId = tenant.id;
        const tenantName = tenant.name;
        const tenantSlug = tenant.slug;

        console.log(`[SuperAdmin] Deleting tenant: ${tenantName} (${tenantSlug}) - ID: ${tenantId}`);

        // Delete in correct order to avoid FK constraint errors
        // 1. Delete recipe sub-items
        const ingredients = await Ingredient.findAll({ where: { TenantId: tenantId }, transaction: t });
        for (const ing of ingredients) {
            await Recipe.destroy({ where: { IngredientId: ing.id }, transaction: t });
        }

        // 2. Delete drink promotion items
        const promos = await DrinkPromotion.findAll({ where: { TenantId: tenantId }, transaction: t });
        for (const promo of promos) {
            const items = await DrinkPromotionItem.findAll({ where: { DrinkPromotionId: promo.id }, transaction: t });
            for (const item of items) {
                await DrinkItemRecipe.destroy({ where: { DrinkPromotionItemId: item.id }, transaction: t });
            }
            await DrinkPromotionItem.destroy({ where: { DrinkPromotionId: promo.id }, transaction: t });
        }
        await DrinkPromotion.destroy({ where: { TenantId: tenantId }, transaction: t });

        // 3. Delete payments (linked to accounts/orders)
        const accounts = await Account.findAll({ where: { TenantId: tenantId }, transaction: t });
        for (const acc of accounts) {
            await Payment.destroy({ where: { AccountId: acc.id }, transaction: t });
        }

        // 4. Delete orders
        await Order.destroy({ where: { TenantId: tenantId }, transaction: t });

        // 5. Delete accounts
        await Account.destroy({ where: { TenantId: tenantId }, transaction: t });

        // 6. Delete cash sessions
        await CashSession.destroy({ where: { TenantId: tenantId }, transaction: t });

        // 7. Delete tables and areas
        const areas = await Area.findAll({ where: { TenantId: tenantId }, transaction: t });
        for (const area of areas) {
            await Table.destroy({ where: { AreaId: area.id }, transaction: t });
        }
        await Area.destroy({ where: { TenantId: tenantId }, transaction: t });

        // 8. Delete products and variants
        const products = await Product.findAll({ where: { TenantId: tenantId }, transaction: t });
        for (const product of products) {
            await ProductVariant.destroy({ where: { ProductId: product.id }, transaction: t });
            await ProductMovement.destroy({ where: { ProductId: product.id }, transaction: t });
        }
        await Product.destroy({ where: { TenantId: tenantId }, transaction: t });

        // 9. Delete ingredients and movements
        await IngredientMovement.destroy({ where: { TenantId: tenantId }, transaction: t });
        await Ingredient.destroy({ where: { TenantId: tenantId }, transaction: t });

        // 10. Delete daily menus, expenses, audit logs
        await DailyMenu.destroy({ where: { TenantId: tenantId }, transaction: t });
        await Expense.destroy({ where: { TenantId: tenantId }, transaction: t });
        await AuditLog.destroy({ where: { TenantId: tenantId }, transaction: t });

        // 11. Delete attendance and reservations
        await Attendance.destroy({ where: { TenantId: tenantId }, transaction: t });
        await Reservation.destroy({ where: { TenantId: tenantId }, transaction: t });

        // 12. Delete users
        await User.destroy({ where: { TenantId: tenantId }, transaction: t });

        // 13. Delete restaurant config
        await RestaurantConfig.destroy({ where: { TenantId: tenantId }, transaction: t });

        // 14. Finally delete the tenant itself
        await Tenant.destroy({ where: { id: tenantId }, transaction: t });

        await t.commit();

        console.log(`[SuperAdmin] Tenant deleted successfully: ${tenantName} (${tenantSlug})`);

        res.json({
            message: `Restaurante "${tenantName}" (${tenantSlug}.maksuites.com.pe) eliminado completamente.`,
            deleted: { id: tenantId, name: tenantName, slug: tenantSlug }
        });
    } catch (err) {
        await t.rollback();
        console.error('[SuperAdmin] Error deleting tenant:', err);
        res.status(500).json({ error: 'Error eliminando restaurante: ' + err.message });
    }
});

// =============================================
// PUT /api/superadmin/tenants/:id/modules
// =============================================
// Enable/disable feature modules for a tenant (stored in tenant.settings JSON)
// All modules default to true (enabled) if not set.
router.put('/tenants/:id/modules', requireSuperAdmin, async (req, res) => {
    try {
        const { modules } = req.body;

        // Validate: modules must be an object with boolean values
        if (!modules || typeof modules !== 'object') {
            return res.status(400).json({ error: 'Se requiere un objeto de módulos' });
        }

        const VALID_MODULES = ['moduloPromocionesHabilitado', 'moduloMenuHabilitado', 'moduloFacturacionHabilitado'];
        const invalidKeys = Object.keys(modules).filter(k => !VALID_MODULES.includes(k));
        if (invalidKeys.length > 0) {
            return res.status(400).json({ error: `Módulos inválidos: ${invalidKeys.join(', ')}` });
        }

        const tenant = await Tenant.findByPk(req.params.id);
        if (!tenant) return res.status(404).json({ error: 'Restaurante no encontrado' });

        // Merge with existing settings
        let currentSettings = {};
        try {
            currentSettings = JSON.parse(tenant.settings || '{}');
        } catch (e) {
            currentSettings = {};
        }

        const updatedSettings = {
            ...currentSettings,
            ...modules
        };

        await tenant.update({ settings: JSON.stringify(updatedSettings) });

        // Return only the module-related keys for clarity
        const returnedModules = VALID_MODULES.reduce((acc, key) => {
            acc[key] = updatedSettings[key] !== false; // default true
            return acc;
        }, {});

        res.json({
            message: 'Módulos actualizados',
            tenant: { id: tenant.id, modules: returnedModules }
        });
    } catch (err) {
        console.error('[SuperAdmin] Error updating modules:', err);
        res.status(500).json({ error: 'Error actualizando módulos' });
    }
});

// =============================================
// GET /api/superadmin/stats
// =============================================
// Global platform stats
router.get('/stats', requireSuperAdmin, async (req, res) => {
    try {
        const [totalTenants, activeTenants, demoPlan, pagoPlan, totalOrders, totalUsers] = await Promise.all([
            Tenant.count(),
            Tenant.count({ where: { status: 'active' } }),
            Tenant.count({ where: { plan: 'demo' } }),
            Tenant.count({ where: { plan: 'pago' } }),
            Order.count(),
            User.count()
        ]);

        res.json({
            platform: {
                totalTenants,
                activeTenants,
                suspendedTenants: totalTenants - activeTenants,
                demoPlan,
                pagoPlan,
                totalOrders,
                totalUsers
            }
        });
    } catch (err) {
        console.error('[SuperAdmin] Error getting stats:', err);
        res.status(500).json({ error: 'Error obteniendo estadísticas' });
    }
});

module.exports = router;
