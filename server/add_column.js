const { sequelize } = require('./models');

async function addColumn() {
    try {
        await sequelize.authenticate();
        console.log('Connected.');
        await sequelize.query("ALTER TABLE ProductMovements ADD COLUMN ProductId INTEGER REFERENCES Products(id) ON DELETE CASCADE;");
        console.log('Column ProductId added.');
    } catch (e) {
        console.error(e);
    }
}

addColumn();
