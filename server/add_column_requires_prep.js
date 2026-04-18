const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Initialize Sequelize (Adjust path to your DB config or use direct connection)
// Assuming SQLite for this project or usage of config/db.js
const dbPath = path.join(__dirname, 'config', 'db.js');
const sequelize = require(dbPath);

async function addColumn() {
    try {
        await sequelize.authenticate();
        console.log("Connected to DB.");

        try {
            await sequelize.getQueryInterface().addColumn('Products', 'requiresPreparation', {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            });
            console.log("SUCCESS: Column 'requiresPreparation' added to Products.");
        } catch (err) {
            console.error("Error adding column (might exist):", err.message);
        }
    } catch (error) {
        console.error("DB Connection Error:", error);
    } finally {
        await sequelize.close();
    }
}

addColumn();
