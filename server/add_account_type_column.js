const sequelize = require('./config/db');

(async () => {
    try {
        await sequelize.authenticate();
        console.log("Adding accountType column to Accounts...");

        // Add column accountType
        try {
            await sequelize.query("ALTER TABLE Accounts ADD COLUMN accountType TEXT DEFAULT 'standard';");
            console.log("SUCCESS: Added accountType column.");
        } catch (e) {
            console.log("Note: accountType column might already exist or error occurred: " + e.message);
        }

        console.log("Migration complete.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await sequelize.close();
    }
})();
