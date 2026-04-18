const { sequelize, Product, ProductVariant } = require('./models');

async function addDeletedAtColumn() {
    const queryInterface = sequelize.getQueryInterface();
    try {
        console.log("Checking Products table...");
        const tableDesc = await queryInterface.describeTable('Products');
        if (!tableDesc.deletedAt) {
            console.log("Adding deletedAt to Products...");
            await queryInterface.addColumn('Products', 'deletedAt', {
                type: 'DATETIME',
                allowNull: true,
            });
        } else {
            console.log("Products already has deletedAt.");
        }

        console.log("Checking ProductVariants table...");
        const tableDescVar = await queryInterface.describeTable('ProductVariants');
        if (!tableDescVar.deletedAt) {
            console.log("Adding deletedAt to ProductVariants...");
            await queryInterface.addColumn('ProductVariants', 'deletedAt', {
                type: 'DATETIME',
                allowNull: true,
            });
        } else {
            console.log("ProductVariants already has deletedAt.");
        }

        console.log("Done.");
    } catch (error) {
        console.error("Error adding column:", error);
    } finally {
        await sequelize.close();
    }
}

addDeletedAtColumn();
