const { sequelize, RestaurantConfig, DailyMenu, Payment, DrinkPromotion, DrinkPromotionItem, User, Product, CashSession, QrAccount, PromotionGroup, Promotion, Setting } = require('./models');

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
        { table: 'Users', column: 'active', type: 'BOOLEAN DEFAULT 1' }
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

    // Create unique index for user pin in SQLite
    try {
        await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_pin ON Users (pin);`);
        console.log(`[Fix] Created unique index users_pin on Users (pin)`);
    } catch (e) {
        // Ignore
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

        // Init Config if not exists
        const config = await RestaurantConfig.findOne();
        if (!config) {
            await RestaurantConfig.create({ name: 'Nuevo Restaurante' });
            console.log('Default config created.');
        }

        // Init Users if none exist
        const { User } = require('./models');
        const usersCount = await User.count();
        if (usersCount === 0) {
            // Note: In prod use bcrypt, here plain for prototype speed as requested "simple login"
            // Or I can add bcrypt now. Let's add bcrypt in the route, but seed plain for now or use hooks.
            // Actually, for simplicity in prototype, I will store plain or simple hash.
            // Let's assume the Auth Route handles comparison.
            await User.bulkCreate([
                { username: 'admin', password: '123', role: 'admin', displayName: 'Administrador' },
                { username: 'mesero', password: '123', role: 'waiter', displayName: 'Mesero 1' },
                { username: 'cocina', password: '123', role: 'kitchen', displayName: 'Jefe Cocina' },
                { username: 'caja', password: '123', role: 'cashier', displayName: 'Cajero Principal' }
            ]);
            console.log('Default users created (admin/123, mesero/123, cocina/123).');
        }

        // Init Products if none
        const { Product } = require('./models');
        const count = await Product.count();
        if (count === 0) {
            await Product.bulkCreate([
                { name: 'Coca Cola', price: 5.00, type: 'drink', stock: 100 },
                { name: 'Lomo Saltado', price: 35.00, type: 'dish', isStockManaged: false },
                { name: 'Ceviche', price: 40.00, type: 'dish', isStockManaged: false },
                { name: 'Cerveza', price: 8.00, type: 'drink', stock: 50 }
            ]);
            console.log('Default products seeded.');
        }

    } catch (error) {
        console.error('Unable to connect to the database:', error);
        process.exit(1); // Fail fast
    }
};

module.exports = syncDB;
