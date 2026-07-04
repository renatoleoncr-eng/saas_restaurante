const { sequelize, Tenant, RestaurantConfig, DailyMenu, Payment, DrinkPromotion, DrinkPromotionItem, User, Product, CashSession, QrAccount, PromotionGroup, Promotion, Setting, BillingConfig } = require('./models');
const bcrypt = require('bcryptjs');

async function runAutomaticFix() {
    console.log("--- RUNNING AUTOMATIC SCHEMA FIX ---");
    const migrations = [
        // ACCOUNTS
        { table: 'Accounts', column: 'paymentMethod', type: 'VARCHAR(255)' },
        { table: 'Accounts', column: 'paymentEvidence', type: 'VARCHAR(255)' },
        { table: 'Accounts', column: 'accountType', type: "VARCHAR(50) DEFAULT 'standard'" },
        { table: 'Accounts', column: 'roulette_interaction', type: "VARCHAR(255) DEFAULT 'none'" },
        { table: 'Accounts', column: 'roulette_prize', type: 'VARCHAR(255)' },
        { table: 'Accounts', column: 'clientAddress', type: 'VARCHAR(255)' },

        // PRODUCTS
        { table: 'Products', column: 'presentations', type: 'TEXT' },
        { table: 'Products', column: 'requiresPreparation', type: 'BOOLEAN DEFAULT 1' },
        { table: 'Products', column: 'category', type: 'VARCHAR(255)' },
        { table: 'Products', column: 'linkedProductId', type: 'INTEGER' },
        { table: 'Products', column: 'happyHourPrice', type: 'DECIMAL(10, 2)' },
        { table: 'Products', column: 'happyHourStart', type: 'TIME' },
        { table: 'Products', column: 'happyHourEnd', type: 'TIME' },

        // RECIPES
        { table: 'Recipes', column: 'presentation', type: 'VARCHAR(255)' },

        // ORDERS
        { table: 'Orders', column: 'presentation', type: 'VARCHAR(255)' },
        { table: 'Orders', column: 'subItemsData', type: 'TEXT' },
        { table: 'Orders', column: 'priceAtOrder', type: 'DECIMAL(10, 2)' },
        { table: 'Orders', column: 'priceAtOrderAtCreation', type: 'DECIMAL(10, 2)' },
        { table: 'Orders', column: 'UserId', type: 'INTEGER' },

        // PRODUCT MOVEMENTS
        { table: 'ProductMovements', column: 'AccountId', type: 'INTEGER' },
        { table: 'ProductMovements', column: 'UserId', type: 'INTEGER' },

        // INGREDIENT MOVEMENTS
        { table: 'IngredientMovements', column: 'AccountId', type: 'INTEGER' },
        { table: 'IngredientMovements', column: 'UserId', type: 'INTEGER' },

        // PAYMENTS
        { table: 'Payments', column: 'AccountId', type: 'INTEGER' },
        { table: 'Payments', column: 'UserId', type: 'INTEGER' },

        // EXPENSES
        { table: 'Expenses', column: 'paymentMethod', type: "VARCHAR(255) DEFAULT 'efectivo'" },
        { table: 'Expenses', column: 'category', type: "VARCHAR(255) DEFAULT 'otros'" },
        { table: 'Expenses', column: 'UserId', type: 'INTEGER' },
        { table: 'Expenses', column: 'date', type: 'DATETIME' },
        { table: 'Expenses', column: 'CashSessionId', type: 'INTEGER' },

        // SESSION LINKS FOR PAYMENTS
        { table: 'Payments', column: 'CashSessionId', type: 'INTEGER' },
        
        // CLIENT SCREEN PAYMENTS QR LINK
        { table: 'Payments', column: 'qr_id', type: 'INTEGER' },

        // BILLING CONFIGS
        { table: 'BillingConfigs', column: 'billingMode', type: "VARCHAR(50) DEFAULT 'libre'" },

        // INVOICES
        { table: 'Invoices', column: 'AccountId', type: 'INTEGER' },
        { table: 'Invoices', column: 'notaCredito', type: 'VARCHAR(255)' },
        { table: 'Invoices', column: 'notaCreditoUrl', type: 'VARCHAR(255)' },

        // USERS
        { table: 'Users', column: 'pin', type: 'VARCHAR(4)' },
        { table: 'Users', column: 'requirePinPrompt', type: 'BOOLEAN DEFAULT 0' },
        { table: 'Users', column: 'active', type: 'BOOLEAN DEFAULT 1' },
        { table: 'Users', column: 'email', type: 'VARCHAR(255)' },

        // MULTI-TENANT: TenantId FK for all tables
        { table: 'RestaurantConfigs', column: 'TenantId', type: 'INTEGER' },
        { table: 'Areas', column: 'TenantId', type: 'INTEGER' },
        { table: 'Tables', column: 'TenantId', type: 'INTEGER' },
        { table: 'Accounts', column: 'TenantId', type: 'INTEGER' },
        { table: 'Products', column: 'TenantId', type: 'INTEGER' },
        { table: 'Users', column: 'TenantId', type: 'INTEGER' },
        { table: 'Orders', column: 'TenantId', type: 'INTEGER' },
        { table: 'Attendances', column: 'TenantId', type: 'INTEGER' },
        { table: 'Reservations', column: 'TenantId', type: 'INTEGER' },
        { table: 'Ingredients', column: 'TenantId', type: 'INTEGER' },
        { table: 'IngredientMovements', column: 'TenantId', type: 'INTEGER' },
        { table: 'ProductMovements', column: 'TenantId', type: 'INTEGER' },
        { table: 'Recipes', column: 'TenantId', type: 'INTEGER' },
        { table: 'AuditLogs', column: 'TenantId', type: 'INTEGER' },
        { table: 'DailyMenus', column: 'TenantId', type: 'INTEGER' },
        { table: 'Expenses', column: 'TenantId', type: 'INTEGER' },
        { table: 'ProductVariants', column: 'TenantId', type: 'INTEGER' },
        { table: 'Payments', column: 'TenantId', type: 'INTEGER' },
        { table: 'DrinkPromotions', column: 'TenantId', type: 'INTEGER' },
        { table: 'DrinkPromotionItems', column: 'TenantId', type: 'INTEGER' },
        { table: 'DrinkItemRecipes', column: 'TenantId', type: 'INTEGER' },
        { table: 'CashSessions', column: 'TenantId', type: 'INTEGER' },
        { table: 'BillingConfigs', column: 'TenantId', type: 'INTEGER' },
        { table: 'Invoices', column: 'TenantId', type: 'INTEGER' },
        { table: 'QrAccounts', column: 'TenantId', type: 'INTEGER' },
        { table: 'PromotionGroups', column: 'TenantId', type: 'INTEGER' },
        { table: 'Promotions', column: 'TenantId', type: 'INTEGER' },
        { table: 'Settings', column: 'TenantId', type: 'INTEGER' }
    ];

    for (const m of migrations) {
        try {
            await sequelize.query(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.type};`);
            console.log(`[Fix] Added ${m.column} to ${m.table}`);
        } catch (e) {
            // Ignore if column already exists
        }
    }

    // Populate priceAtOrderAtCreation for legacy orders
    try {
        await sequelize.query(`UPDATE Orders SET priceAtOrderAtCreation = priceAtOrder WHERE priceAtOrderAtCreation IS NULL;`);
        console.log(`[Fix] Populated priceAtOrderAtCreation for legacy orders`);
    } catch (e) {
        console.error(`[Fix] Error populating priceAtOrderAtCreation:`, e);
    }

    // Tenant-scoped compound indexes (replace global unique indexes)
    const compoundIndexes = [
        { name: 'idx_users_tenant_username', table: 'Users', columns: 'TenantId, username' },
        { name: 'idx_users_tenant_pin', table: 'Users', columns: 'TenantId, pin' },
        { name: 'idx_areas_tenant', table: 'Areas', columns: 'TenantId' },
        { name: 'idx_products_tenant', table: 'Products', columns: 'TenantId' },
        { name: 'idx_accounts_tenant', table: 'Accounts', columns: 'TenantId' },
        { name: 'idx_orders_tenant', table: 'Orders', columns: 'TenantId' },
    ];

    for (const idx of compoundIndexes) {
        try {
            await sequelize.query(`CREATE INDEX IF NOT EXISTS \`${idx.name}\` ON \`${idx.table}\` (${idx.columns});`);
            console.log(`[Fix] Created compound index ${idx.name}`);
        } catch (e) {
            // Ignore if exists
        }
    }
}

async function createDbIndexes() {
    console.log("--- CREATING DATABASE INDEXES FOR PERFORMANCE ---");
    const isMySQL = sequelize.getDialect() === 'mysql';
    
    const indexes = [
        { name: 'idx_productmovements_productid', table: 'ProductMovements', columns: 'ProductId' },
        { name: 'idx_productmovements_createdat', table: 'ProductMovements', columns: 'createdAt' },
        { name: 'idx_productmovements_variantid', table: 'ProductMovements', columns: 'ProductVariantId' },
        { name: 'idx_ingredientmovements_ingredientid', table: 'IngredientMovements', columns: 'IngredientId' },
        { name: 'idx_ingredientmovements_createdat', table: 'IngredientMovements', columns: 'createdAt' },
        { name: 'idx_productvariants_productid', table: 'ProductVariants', columns: 'ProductId' },
        { name: 'idx_recipes_productid', table: 'Recipes', columns: 'ProductId' },
        { name: 'idx_recipes_ingredientid', table: 'Recipes', columns: 'IngredientId' },
        { name: 'idx_orders_accountid', table: 'Orders', columns: 'AccountId' },
        { name: 'idx_orders_productid', table: 'Orders', columns: 'ProductId' },
        { name: 'idx_accounts_createdat', table: 'Accounts', columns: 'createdAt' },
        { name: 'idx_accounts_status', table: 'Accounts', columns: 'status' },
        { name: 'idx_payments_createdat', table: 'Payments', columns: 'createdAt' },
        { name: 'idx_payments_accountid', table: 'Payments', columns: 'AccountId' },
        { name: 'idx_expenses_date', table: 'Expenses', columns: 'date' },
        { name: 'idx_auditlogs_createdat', table: 'AuditLogs', columns: 'createdAt' },
        { name: 'idx_auditlogs_userid', table: 'AuditLogs', columns: 'UserId' }
    ];

    for (const idx of indexes) {
        try {
            if (isMySQL) {
                try {
                    await sequelize.query(`ALTER TABLE \`${idx.table}\` ADD INDEX \`${idx.name}\` (\`${idx.columns}\`);`);
                    console.log(`[Index] Created index ${idx.name} on ${idx.table} (MySQL)`);
                } catch (mysqlErr) {
                    if (mysqlErr.original && mysqlErr.original.errno === 1061) {
                        // Index already exists, ignore
                    } else {
                        console.error(`[Index] Failed to create index ${idx.name} on ${idx.table} (MySQL):`, mysqlErr.message);
                    }
                }
            } else {
                await sequelize.query(`CREATE INDEX IF NOT EXISTS \`${idx.name}\` ON \`${idx.table}\` (\`${idx.columns}\`);`);
                console.log(`[Index] Created/Verified index ${idx.name} on ${idx.table} (SQLite)`);
            }
        } catch (e) {
            console.error(`[Index] General error creating index ${idx.name} on ${idx.table}:`, e.message);
        }
    }
}

const syncDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected...');

        // 1. Core Model Sync
        // Enable native alter for MySQL to automatically add missing columns securely.
        // Prevent dropping columns or tables to ensure data safety.
        const isMySQL = sequelize.getDialect() === 'mysql';
        const syncOptions = isMySQL ? { alter: { drop: false } } : { alter: false };

        await sequelize.sync(syncOptions);
        console.log(`Tables initialized/verified (alter: ${isMySQL}).`);

        // 2. Comprehensive Schema Fix (Fallback for manual patching on SQLite)
        if (!isMySQL) {
            await runAutomaticFix();
            console.log('SQLite manual schema migration check complete.');
        }

        // 3. Sync Remaining (Safe fallback)
        await DailyMenu.sync();
        await Payment.sync();
        await DrinkPromotion.sync();
        await DrinkPromotionItem.sync();
        await CashSession.sync();
        await QrAccount.sync();
        await PromotionGroup.sync();
        await Promotion.sync();
        await Setting.sync();
        console.log("Specific models synced.");

        // 4. Create Indexes for query performance
        await createDbIndexes();
        console.log("Database indexes verified/created.");

        // =============================================
        // MULTI-TENANT: Create default tenant for legacy data
        // =============================================
        const tenantCount = await Tenant.count();
        if (tenantCount === 0) {
            // Check if there's existing data without a tenant
            const existingUsers = await User.count();
            if (existingUsers > 0) {
                // Migration mode: create tenant for existing Makala restaurant
                // Read name from existing config if available
                let existingName = 'El Makala';
                try {
                    const existingConfig = await RestaurantConfig.findOne();
                    if (existingConfig && existingConfig.name) existingName = existingConfig.name;
                } catch (e) { /* ignore */ }

                console.log(`[Multi-Tenant] Migrating existing data to tenant "${existingName}" (makala.maksuites.com.pe)...`);
                const defaultTenant = await Tenant.create({
                    name: existingName,
                    slug: 'makala',
                    ownerEmail: 'admin@maksuites.com.pe',
                    plan: 'pago',
                    status: 'active'
                });

                // Assign all existing rows to the default tenant
                const tablesToMigrate = [
                    'RestaurantConfigs', 'Areas', 'Tables', 'Accounts', 'Products',
                    'Users', 'Orders', 'Attendances', 'Reservations', 'Ingredients',
                    'IngredientMovements', 'ProductMovements', 'Recipes', 'AuditLogs',
                    'DailyMenus', 'Expenses', 'ProductVariants', 'Payments',
                    'DrinkPromotions', 'DrinkPromotionItems', 'DrinkItemRecipes',
                    'CashSessions', 'BillingConfigs', 'Invoices', 'QrAccounts',
                    'PromotionGroups', 'Promotions', 'Settings'
                ];

                for (const table of tablesToMigrate) {
                    try {
                        await sequelize.query(
                            `UPDATE \`${table}\` SET TenantId = ${defaultTenant.id} WHERE TenantId IS NULL;`
                        );
                    } catch (e) {
                        // Table might not exist yet
                    }
                }
                console.log(`[Multi-Tenant] Migrated existing data to tenant "${defaultTenant.name}" (ID: ${defaultTenant.id})`);
            }
        }

        // Init Config if not exists (for default tenant)
        const config = await RestaurantConfig.findOne();
        if (!config) {
            // Get or create a default tenant
            let defaultTenant = await Tenant.findOne({ where: { slug: 'makala' } });
            if (!defaultTenant) {
                defaultTenant = await Tenant.create({
                    name: 'Nuevo Restaurante',
                    slug: 'makala',
                    ownerEmail: 'admin@maksuites.com.pe',
                    plan: 'demo',
                    status: 'active'
                });
            }
            await RestaurantConfig.create({ name: 'Nuevo Restaurante', TenantId: defaultTenant.id });
            console.log('Default config created.');
        }

        // Init Users if none exist
        const { User: UserModel } = require('./models');
        const usersCount = await UserModel.count();
        if (usersCount === 0) {
            let defaultTenant = await Tenant.findOne({ where: { slug: 'makala' } });
            if (!defaultTenant) {
                defaultTenant = await Tenant.create({
                    name: 'Nuevo Restaurante',
                    slug: 'makala',
                    ownerEmail: 'admin@maksuites.com.pe',
                    plan: 'demo',
                    status: 'active'
                });
            }
            const hashedPass = await bcrypt.hash('123', 10);
            await UserModel.bulkCreate([
                { username: 'admin', password: hashedPass, role: 'admin', displayName: 'Administrador', TenantId: defaultTenant.id },
                { username: 'mesero', password: hashedPass, role: 'waiter', displayName: 'Mesero 1', TenantId: defaultTenant.id },
                { username: 'cocina', password: hashedPass, role: 'kitchen', displayName: 'Jefe Cocina', TenantId: defaultTenant.id },
                { username: 'caja', password: hashedPass, role: 'cashier', displayName: 'Cajero Principal', TenantId: defaultTenant.id }
            ]);
            console.log('Default users created with bcrypt hashed passwords (admin/123, mesero/123, cocina/123, caja/123).');
        }

        // Init Products if none
        const { Product: ProductModel } = require('./models');
        const count = await ProductModel.count();
        if (count === 0) {
            const defaultTenant = await Tenant.findOne({ where: { slug: 'makala' } });
            if (defaultTenant) {
                await ProductModel.bulkCreate([
                    { name: 'Coca Cola', price: 5.00, type: 'drink', stock: 100, TenantId: defaultTenant.id },
                    { name: 'Lomo Saltado', price: 35.00, type: 'dish', isStockManaged: false, TenantId: defaultTenant.id },
                    { name: 'Ceviche', price: 40.00, type: 'dish', isStockManaged: false, TenantId: defaultTenant.id },
                    { name: 'Cerveza', price: 8.00, type: 'drink', stock: 50, TenantId: defaultTenant.id }
                ]);
                console.log('Default products seeded.');
            }
        }

    } catch (error) {
        console.error('Unable to connect to the database:', error);
        process.exit(1); // Fail fast
    }
};

module.exports = syncDB;
