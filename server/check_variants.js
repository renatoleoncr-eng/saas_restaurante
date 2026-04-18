const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
});

const ProductVariant = sequelize.define('ProductVariant', {
    ProductId: DataTypes.INTEGER,
    name: DataTypes.STRING,
    price: DataTypes.DECIMAL(10, 2),
    stock: DataTypes.INTEGER
});

async function checkVariants() {
    try {
        await sequelize.authenticate();
        const variants = await ProductVariant.findAll({ where: { ProductId: 1 } });
        console.log("Variants for Product 1 (Coca Cola):");
        if (variants.length === 0) {
            console.log("No variants found in ProductVariant table!");
        } else {
            variants.forEach(v => console.log(`ID: ${v.id} | Name: ${v.name} | Stock: ${v.stock}`));
        }
    } catch (e) {
        console.error(e);
    }
}
checkVariants();
