const { Product } = require('./models');
const { Op } = require('sequelize');

(async () => {
    try {
        const names = ['Ceviche', 'Coca', 'Cerveza', 'Men'];
        const products = await Product.findAll({
            where: {
                [Op.or]: names.map(n => ({ name: { [Op.like]: `%${n}%` } }))
            }
        });

        if (products.length === 0) {
            console.log("No matching products found.");
        } else {
            console.table(products.map(p => ({
                id: p.id,
                name: p.name,
                type: p.type,
                stock: p.stock
            })));
        }
    } catch (err) {
        console.error("Error:", err);
    }
})();
