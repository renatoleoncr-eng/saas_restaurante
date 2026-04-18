const { sequelize, RestaurantConfig, DailyMenu, Payment, DrinkPromotion, DrinkPromotionItem, User, Product } = require('./models');

async function runAutomaticFix() {
    console.log("--- RUNNING AUTOMATIC SCHEMA FIX ---");
    const migrations = [
        // ACCOUNTS
        { table: 'Accounts', column: 'paymentMethod', type: 'VARCHAR(255)' },
        { table: 'Accounts', column: 'paymentEvidence', type: 'VARCHAR(255)' },
        { table: 'Accounts', column: 'accountType', type: "VARCHAR(50) DEFAULT 'standard'" },

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
        { table: 'Expenses', column: 'date', type: 'DATETIME' }
    ];

    for (const m of migrations) {
        try {
            await sequelize.query(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.type};`);
            console.log(`[Fix] Added ${m.column} to ${m.table}`);
        } catch (e) {
            // Ignore if column already exists
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
        console.log("Specific models synced.");

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
