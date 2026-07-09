const { Sequelize, DataTypes, Op } = require('sequelize');
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
});

const Product = sequelize.define('Product', { 
    name: DataTypes.STRING, 
    type: DataTypes.STRING, 
    requiresPreparation: DataTypes.BOOLEAN
});

async function run() {
    try {
        const products = await Product.findAll({ 
            where: { name: { [Op.like]: '%Ceviche%' } }
        });
        console.log("Ceviche Products:");
        products.forEach(p => {
            console.log(`- ID: ${p.id}, Name: ${p.name}, requiresPreparation: ${p.requiresPreparation}`);
        });
    } catch (e) {
        console.error(e);
    }
}
run();
