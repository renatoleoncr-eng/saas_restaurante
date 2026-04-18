const { sequelize } = require('./models');

async function forceUpdate() {
    try {
        await sequelize.authenticate();
        console.log("Connected. Syncing with alter: true...");
        await sequelize.sync({ alter: true });
        console.log("SUCCESS: Database synced.");
    } catch (error) {
        console.error("ERROR:", error);
    } finally {
        await sequelize.close();
    }
}

forceUpdate();
