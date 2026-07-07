/**
 * Tenant Seed Utility
 * 
 * Creates initial data for a newly registered tenant:
 * - RestaurantConfig with tenant name
 * - BillingConfig with defaults
 * - Default area with tables
 * - Default admin user (already created by registration)
 * - Default products (optional)
 * - Default settings
 */

const bcrypt = require('bcryptjs');

async function seedTenantData(tenantId, tenantName, models, t) {
    const {
        RestaurantConfig,
        BillingConfig,
        Area,
        Table,
        Setting
    } = models;

    // 1. Restaurant Config
    await RestaurantConfig.create({
        name: tenantName,
        address: '',
        TenantId: tenantId
    }, { transaction: t });

    // 2. Billing Config (defaults for Peru)
    await BillingConfig.create({
        ruc: '',
        razonSocial: tenantName,
        direccion: '',
        facturacionElectronica: false,
        igvTasa: 10.50,
        operacionesExoneradas: false,
        serieFactura: 'F001',
        serieBoleta: 'B001',
        billingMode: 'libre',
        TenantId: tenantId
    }, { transaction: t });

    // 3. (Removed) Default Area and Tables - user must create them during onboarding.


    // 4. Default Settings
    const defaultSettings = [
        { key: 'roulette_enabled', value: 'false', description: 'Habilitar ruleta de premios', TenantId: tenantId },
        { key: 'client_screen_mode', value: 'ads', description: 'Modo de pantalla cliente', TenantId: tenantId },
    ];

    for (const setting of defaultSettings) {
        try {
            await Setting.create(setting, { transaction: t });
        } catch (e) {
            // Ignore if already exists
        }
    }

    console.log(`[Tenant Seed] Data seeded for tenant "${tenantName}" (ID: ${tenantId})`);
}

module.exports = { seedTenantData };
