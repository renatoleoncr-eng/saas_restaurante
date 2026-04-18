const { Order, Product, User } = require('./models');

(async () => {
    try {
        console.log("Attempting to fetch menu orders with User include...");

        // Fetch last 5 Menu Orders with User include
        const orders = await Order.findAll({
            limit: 5,
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: Product,
                    where: { type: 'menu' },
                    attributes: ['name', 'price']
                },
                {
                    model: User,
                    attributes: ['username', 'displayName']
                }
            ]
        });

        console.log(`Successfully fetched ${orders.length} orders.`);

        if (orders.length > 0) {
            console.log("Sample Order:", JSON.stringify(orders[0].toJSON(), null, 2));
        }

    } catch (err) {
        console.error("CRITICAL ERROR:", err);
    }
})();
