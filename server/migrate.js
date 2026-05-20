const sequelize = require('./config/db');

async function run() {
    try {
        // Try adding the column in both SQLite and MySQL compatible way
        await sequelize.query("ALTER TABLE `BillingConfigs` ADD COLUMN `direccion` VARCHAR(255) NULL;");
        console.log("Column 'direccion' added to 'BillingConfigs' successfully.");
    } catch (err) {
        if (err.message.includes('duplicate column name') || err.message.includes('already exists') || err.message.includes('duplicate')) {
            console.log("Column 'direccion' already exists in 'BillingConfigs'.");
        } else {
            console.error("Migration warning/info:", err.message);
        }
    } finally {
        await sequelize.close();
    }
}

run();
