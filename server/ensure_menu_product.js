const { Product, sequelize } = require('./models');

const fix = async () => {
    try {
        await sequelize.authenticate();

        // Check if any product of type 'menu' exists
        const count = await Product.count({ where: { type: 'menu' } });

        if (count === 0) {
            console.log("No menu product found. Creating default...");
            await Product.create({
                name: "Menú del Día",
                price: 12.00,
                type: 'menu',
                isStockManaged: true,
                stock: 100
            });
            console.log("Created 'Menú del Día' product.");
        } else {
            console.log("Menu product exists.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        // Need to close connection? Usually yes for scripts.
        // sequelize.close(); // Force close logic if needed, but script will exit.
    }
};

fix();
