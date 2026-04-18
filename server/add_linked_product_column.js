const { sequelize } = require('./models');

async function addColumn() {
    try {
        await sequelize.authenticate();
        console.log("Connected to DB.");

        try {
            await sequelize.query("ALTER TABLE Products ADD COLUMN linkedProductId INTEGER;");
            console.log("SUCCESS: Column 'linkedProductId' added to Products.");
        } catch (err) {
            if (err.message.includes("duplicate column name")) {
                console.log("Column 'linkedProductId' already exists.");
            } else {
                console.error("Error adding column:", err.message);
            }
        }
    } catch (error) {
        console.error("DB Connection Error:", error);
    } finally {
        await sequelize.close();
    }
}

addColumn();
