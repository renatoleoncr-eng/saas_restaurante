const { Product } = require('./models');
const { Op } = require('sequelize');

async function run() {
    const products = await Product.findAll({
        where: { name: { [Op.like]: '%Jarra de jugo%' }, TenantId: 1 }
    });
    console.log(`Found ${products.length} products matching 'Jarra de jugo':`);
    products.forEach(p => console.log(`- ID: ${p.id}, Name: ${p.name}, Stock: ${p.stock}, Type: ${p.type}, deletedAt: ${p.deletedAt}`));
}
run();
