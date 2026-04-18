const sequelize = require('./config/db');

(async () => {
    try {
        const [results, metadata] = await sequelize.query("PRAGMA table_info(Orders);");
        console.table(results);
    } catch (err) {
        console.error("Error:", err);
    }
})();
