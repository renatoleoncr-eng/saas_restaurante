const sequelize = require('./config/db');
const { QueryTypes } = require('sequelize');

async function migrate() {
    try {
        console.log("Starting Happy Hour migration...");

        await sequelize.query('ALTER TABLE `Products` ADD COLUMN `happyHourPrice` DECIMAL(10,2) NULL;');
        console.log("Added happyHourPrice to Products");

        await sequelize.query('ALTER TABLE `Products` ADD COLUMN `happyHourStart` TIME NULL;');
        console.log("Added happyHourStart to Products");

        await sequelize.query('ALTER TABLE `Products` ADD COLUMN `happyHourEnd` TIME NULL;');
        console.log("Added happyHourEnd to Products");

        console.log("Migration complete.");
    } catch (err) {
        console.error("Migration failed. It might already have been applied.");
        console.error(err.message);
    } finally {
        process.exit();
    }
}

migrate();
