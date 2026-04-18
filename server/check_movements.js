const { ProductMovement, Product } = require('./models');
const { Op } = require('sequelize');

(async () => {
    try {
        console.log("Checking last 20 Product Movements...");
        const movements = await ProductMovement.findAll({
            limit: 20,
            order: [['createdAt', 'DESC']],
            include: [{ model: Product, attributes: ['name', 'type'] }]
        });

        if (movements.length === 0) {
            console.log("No Product Movements found.");
        } else {
            console.table(movements.map(m => ({
                id: m.id,
                product: m.Product ? m.Product.name : 'Unknown',
                type: m.Product ? m.Product.type : 'Unknown',
                amount: m.amount,
                reason: m.reason,
                date: m.createdAt
            })));
        }
    } catch (err) {
        console.error("Error:", err);
    }
})();
