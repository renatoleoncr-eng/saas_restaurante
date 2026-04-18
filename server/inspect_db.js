const { sequelize } = require('./models');

async function inspect() {
    try {
        const tables = ['Payments', 'Accounts', 'Expenses', 'Orders', 'Products', 'Users'];
        for (const table of tables) {
            console.log(`\n--- Structure of ${table} ---`);
            const [results] = await sequelize.query(`PRAGMA table_info(${table});`);
            results.forEach(col => {
                console.log(`${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PK' : ''}`);
            });
        }
    } catch (err) {
        console.error("Error inspecting database:", err);
    } finally {
        process.exit();
    }
}

inspect();
