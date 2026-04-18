const { sequelize } = require('./models');

async function migrate() {
    try {
        console.log("Starting ProductVariants table migration...");

        // Use raw query to avoid Sequelize altering constraints on SQLite
        await sequelize.query('ALTER TABLE ProductVariants ADD COLUMN happyHourPrice DECIMAL(10, 2) NULL');
        console.log("Added happyHourPrice");

        await sequelize.query('ALTER TABLE ProductVariants ADD COLUMN happyHourStart TIME NULL');
        console.log("Added happyHourStart");

        await sequelize.query('ALTER TABLE ProductVariants ADD COLUMN happyHourEnd TIME NULL');
        console.log("Added happyHourEnd");

        console.log("Migration completed successfully!");
    } catch (err) {
        if (err.message.includes('duplicate column name')) {
            console.log("Columns already exist. Skipping.");
        } else {
            console.error("Migration failed:", err);
        }
    } finally {
        process.exit();
    }
}

migrate();
