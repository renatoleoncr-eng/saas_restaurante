const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Setup Sequelize (Copy form db.js)
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
});

const Product = sequelize.define('Product', {
    name: DataTypes.STRING,
    type: DataTypes.STRING,
    price: DataTypes.DECIMAL(10, 2),
    presentations: DataTypes.TEXT,
    isStockManaged: DataTypes.BOOLEAN
});

async function run() {
    try {
        await sequelize.authenticate();
        console.log("DB Connected.");

        // 1. Inspect Coca Cola
        const coke = await Product.findOne({ where: { name: 'Coca Cola' } });
        if (coke) {
            console.log("--- Coca Cola ---");
            console.log("Presentations:", coke.presentations);
            console.log("Type:", coke.type);
        } else {
            console.log("Coca Cola not found.");
        }

        // 2. Check/Create Menus
        const menus = ['Menú del Día', 'Menú ejecutivo'];
        for (const mName of menus) {
            let p = await Product.findOne({ where: { name: mName } });
            if (!p) {
                console.log(`Creating missing menu product: ${mName}`);
                await Product.create({
                    name: mName,
                    type: 'menu',
                    price: mName === 'Menú del Día' ? 14.00 : 20.00, // Default prices from screenshot
                    isStockManaged: false, // Menus usually don't have direct stock, their components do.
                    presentations: '[]'
                });
            } else {
                console.log(`Menu product exists: ${mName} (ID: ${p.id})`);
                // Ensure type is 'menu'
                if (p.type !== 'menu') {
                    console.log(`Updating type for ${mName} to 'menu'`);
                    p.type = 'menu';
                    await p.save();
                }
            }
        }

    } catch (e) {
        console.error(e);
    }
}

run();
