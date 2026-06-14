const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'database.sqlite'),
    logging: false
});

const Table = sequelize.define('Table', {
    number: DataTypes.INTEGER,
    status: DataTypes.ENUM('free', 'occupied', 'reserved'),
});

const Account = sequelize.define('Account', {
    status: DataTypes.ENUM('open', 'closed', 'cancelled'),
    customerName: DataTypes.STRING,
    total: DataTypes.DECIMAL(10, 2),
    accountType: DataTypes.ENUM('standard', 'staff'),
    TableId: DataTypes.INTEGER
});

async function main() {
    try {
        const openAccounts = await Account.findAll({ where: { status: 'open' } });
        console.log("--- OPEN ACCOUNTS ---");
        console.log(JSON.stringify(openAccounts.map(a => ({
            id: a.id,
            status: a.status,
            customerName: a.customerName,
            total: a.total,
            accountType: a.accountType,
            TableId: a.TableId
        })), null, 2));

        const tables = await Table.findAll();
        console.log("\n--- TABLES ---");
        console.log(JSON.stringify(tables.map(t => ({
            id: t.id,
            number: t.number,
            status: t.status
        })), null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
}

main();
