const { sequelize } = require('./models');
const { DataTypes } = require('sequelize');

async function run() {
    try {
        console.log("Adding batchId column to Orders table...");
        const queryInterface = sequelize.getQueryInterface();
        await queryInterface.addColumn('Orders', 'batchId', {
            type: DataTypes.STRING,
            allowNull: true
        });
        console.log("Column batchId added successfully!");
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

run();
