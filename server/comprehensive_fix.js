const { sequelize } = require('./models');

async function runComprehensiveFix() {
    console.log("--- STARTING COMPREHENSIVE DATABASE FIX ---");
    try {
        await sequelize.authenticate();
        console.log("Connected to database.");

        const migrations = [
            // ACCOUNTS
            { table: 'Accounts', column: 'paymentMethod', type: 'VARCHAR(255)' },
            { table: 'Accounts', column: 'paymentEvidence', type: 'TEXT' },
            { table: 'Accounts', column: 'accountType', type: "VARCHAR(50) DEFAULT 'standard'" },
            { table: 'Accounts', column: 'closedAt', type: 'DATETIME' },

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
                process.stdout.write(`Adding ${m.column} to ${m.table}... `);
                await sequelize.query(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.type};`);
                console.log("SUCCESS");
            } catch (e) {
                if (e.message.includes('duplicate column name') || e.message.includes('already exists') || e.message.includes('Duplicate column')) {
                    try {
                        process.stdout.write(`Already exists, modifying ${m.column}... `);
                        await sequelize.query(`ALTER TABLE ${m.table} MODIFY COLUMN ${m.column} ${m.type};`);
                        console.log("SUCCESS");
                    } catch (modErr) {
                        console.log(`MODIFICATION FAILED: ${modErr.message}`);
                    }
                } else {
                    console.log(`FAILED: ${e.message}`);
                }
            }
        }

        console.log("\n--- EXPLICIT TABLE CREATION (RAW SQL) ---");
        // Ensure DrinkPromotion table exists
        try {
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS DrinkPromotions (
                    id INTEGER PRIMARY KEY AUTO_INCREMENT,
                    name VARCHAR(255) NOT NULL,
                    price DECIMAL(10,2) NOT NULL,
                    active BOOLEAN DEFAULT 1,
                    createdAt DATETIME NOT NULL,
                    updatedAt DATETIME NOT NULL
                ) ENGINE=InnoDB;
            `);
            console.log("DrinkPromotions table verified/created.");
        } catch (e) { console.log("DrinkPromotions creation error:", e.message); }

        // Ensure DrinkPromotionItems table exists
        try {
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS DrinkPromotionItems (
                    id INTEGER PRIMARY KEY AUTO_INCREMENT,
                    name VARCHAR(255) NOT NULL,
                    individualPrice DECIMAL(10,2) DEFAULT 0,
                    type ENUM('free', 'finished', 'prepared') DEFAULT 'free',
                    linkedProductId INTEGER,
                    DrinkPromotionId INTEGER,
                    createdAt DATETIME NOT NULL,
                    updatedAt DATETIME NOT NULL,
                    FOREIGN KEY (DrinkPromotionId) REFERENCES DrinkPromotions(id) ON DELETE CASCADE
                ) ENGINE=InnoDB;
            `);
            console.log("DrinkPromotionItems table verified/created.");
        } catch (e) { console.log("DrinkPromotionItems creation error:", e.message); }

        console.log("\n--- SYNCING SPECIFIC MODELS ---");
        const { DrinkPromotion, DrinkPromotionItem, DailyMenu, Payment } = require('./models');
        try { await DrinkPromotion.sync(); } catch (e) { console.log("DrinkPromotion Sync Error:", e.message); }
        try { await DrinkPromotionItem.sync(); } catch (e) { console.log("DrinkPromotionItem Sync Error:", e.message); }
        try { await DailyMenu.sync(); } catch (e) { console.log("DailyMenu Sync Error:", e.message); }
        try { await Payment.sync(); } catch (e) { console.log("Payment Sync Error:", e.message); }
        console.log("Specific models sync finished.");

        console.log("\n--- FINAL GLOBAL SYNC ---");
        try { await sequelize.sync({ alter: false }); console.log("Global sync finished."); } catch (e) { console.log("Global sync error:", e.message); }

        console.log("\n--- DATABASE REPAIR COMPLETE ---");
    } catch (err) {
        console.error("\nCRITICAL ERROR DURING FIX:", err);
    } finally {
        await sequelize.close();
        process.exit();
    }
}

runComprehensiveFix();
