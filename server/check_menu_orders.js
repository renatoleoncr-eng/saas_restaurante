const { Order, Product } = require('./models');

(async () => {
    try {
        console.log("Checking recent Menu Orders...");
        const orders = await Order.findAll({
            limit: 10,
            order: [['createdAt', 'DESC']],
            include: [{
                model: Product,
                where: { type: 'menu' },
                attributes: ['name', 'type']
            }]
        });

        if (orders.length === 0) {
            console.log("No Menu Orders found.");
        } else {
            console.log(`Found ${orders.length} menu orders.`);
            orders.forEach(o => {
                console.log(`ID: ${o.id} | Menu: ${o.Product.name} | Note: ${o.notes}`);
                console.log(`SubItems: ${o.subItemsData}`);
                console.log('---');
            });
        }
    } catch (err) {
        console.error("Error:", err);
    }
})();
