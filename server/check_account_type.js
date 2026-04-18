const { Sequelize } = require('sequelize');
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
});

async function run() {
    try {
        const [results] = await sequelize.query("PRAGMA table_info(Accounts);");
        console.log("Columnas en Accounts:");
        console.table(results);

        const [data] = await sequelize.query("SELECT id, customerName, accountType FROM Accounts ORDER BY id DESC LIMIT 5");
        console.log("\nÚltimas 5 cuentas:");
        console.table(data);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
