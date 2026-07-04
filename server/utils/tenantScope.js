/**
 * Tenant Scope Helpers
 * 
 * Utility functions to simplify tenant-scoped database operations.
 * Instead of modifying every single query in every route file,
 * these helpers wrap Sequelize operations to automatically inject tenantId.
 * 
 * Usage in routes:
 *   const { scopedFindAll, scopedCreate } = require('../utils/tenantScope');
 *   
 *   router.get('/products', async (req, res) => {
 *       const products = await scopedFindAll(Product, req);
 *       res.json(products);
 *   });
 */

/**
 * Get the tenantId from the request.
 * Throws if no tenant is set (should be caught by requireTenant middleware).
 */
function getTenantId(req) {
    if (!req.tenant || !req.tenant.id) {
        throw new Error('No tenant context available');
    }
    return req.tenant.id;
}

/**
 * Inject tenantId into a where clause.
 */
function tenantWhere(req, where = {}) {
    return { ...where, TenantId: getTenantId(req) };
}

/**
 * Scoped findAll — automatically adds tenantId filter.
 */
async function scopedFindAll(Model, req, options = {}) {
    const where = tenantWhere(req, options.where || {});
    return Model.findAll({ ...options, where });
}

/**
 * Scoped findOne — automatically adds tenantId filter.
 */
async function scopedFindOne(Model, req, options = {}) {
    const where = tenantWhere(req, options.where || {});
    return Model.findOne({ ...options, where });
}

/**
 * Scoped findByPk — finds by PK AND verifies it belongs to the tenant.
 */
async function scopedFindByPk(Model, req, pk, options = {}) {
    const record = await Model.findByPk(pk, options);
    if (!record) return null;
    if (record.TenantId !== getTenantId(req)) return null;
    return record;
}

/**
 * Scoped create — automatically injects tenantId.
 */
async function scopedCreate(Model, req, data, options = {}) {
    return Model.create({ ...data, TenantId: getTenantId(req) }, options);
}

/**
 * Scoped bulkCreate — automatically injects tenantId into all records.
 */
async function scopedBulkCreate(Model, req, records, options = {}) {
    const tenantId = getTenantId(req);
    const scopedRecords = records.map(r => ({ ...r, TenantId: tenantId }));
    return Model.bulkCreate(scopedRecords, options);
}

/**
 * Scoped update — automatically adds tenantId filter.
 */
async function scopedUpdate(Model, req, data, options = {}) {
    const where = tenantWhere(req, options.where || {});
    return Model.update(data, { ...options, where });
}

/**
 * Scoped destroy — automatically adds tenantId filter.
 */
async function scopedDestroy(Model, req, options = {}) {
    const where = tenantWhere(req, options.where || {});
    return Model.destroy({ ...options, where });
}

/**
 * Scoped count — automatically adds tenantId filter.
 */
async function scopedCount(Model, req, options = {}) {
    const where = tenantWhere(req, options.where || {});
    return Model.count({ ...options, where });
}

/**
 * Scoped findAndCountAll — automatically adds tenantId filter.
 */
async function scopedFindAndCountAll(Model, req, options = {}) {
    const where = tenantWhere(req, options.where || {});
    return Model.findAndCountAll({ ...options, where });
}

/**
 * Scoped findOrCreate — automatically adds tenantId filter and injects tenantId.
 */
async function scopedFindOrCreate(Model, req, options = {}) {
    const where = tenantWhere(req, options.where || {});
    const defaults = { ...(options.defaults || {}), TenantId: getTenantId(req) };
    return Model.findOrCreate({ ...options, where, defaults });
}

module.exports = {
    getTenantId,
    tenantWhere,
    scopedFindAll,
    scopedFindOne,
    scopedFindByPk,
    scopedCreate,
    scopedBulkCreate,
    scopedUpdate,
    scopedDestroy,
    scopedCount,
    scopedFindAndCountAll,
    scopedFindOrCreate
};
