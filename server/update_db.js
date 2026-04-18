const { sequelize } = require('./models');

async function updateSchema() {
    try {
        await sequelize.sync({ alter: true });
        console.log("Database schema updated successfully.");
    } catch (error) {
        console.error("Error updating schema:", error);
    } finally {
        await sequelize.close();
    }
}

updateSchema();
