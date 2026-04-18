const { Product } = require('./models');
const { Op } = require('sequelize');

(async () => {
    try {
        console.log("Checking for Menu Products...");
        const products = await Product.findAll({
            where: {
                name: { [Op.like]: '%Men%' }
            }
        });

        if (products.length === 0) {
            console.log("NO MENU PRODUCTS FOUND!");
        } else {
            products.forEach(p => {
                console.log(`Product: "${p.name}" (ID: ${p.id}) | Type: ${p.type} | Stock: ${p.stock}`);
            });
        }

    } catch (err) {
        console.error("Error:", err);
    }
})();
