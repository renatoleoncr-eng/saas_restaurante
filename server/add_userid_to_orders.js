const sequelize = require('./config/db');

(async () => {
    try {
        console.log("Adding UserId column to Orders...");
        await sequelize.query("ALTER TABLE Orders ADD COLUMN UserId INTEGER REFERENCES Users(id) ON DELETE SET NULL;");
        console.log("Column added successfully.");
    } catch (err) {
        if (err.message.includes("duplicate column name")) {
            console.log("Column already exists.");
        } else {
            console.error("Error adding column:", err);
        }
    }
})();
