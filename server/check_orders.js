const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
});

const Order = sequelize.define('Order', {
    quantity: DataTypes.INTEGER,
    priceAtOrder: DataTypes.DECIMAL(10, 2),
    status: DataTypes.STRING,
    presentation: DataTypes.STRING,
    subItemsData: DataTypes.TEXT,
    AccountId: DataTypes.INTEGER,
    ProductId: DataTypes.INTEGER
});
const Product = sequelize.define('Product', {
    name: DataTypes.STRING,
    type: DataTypes.STRING
});
Order.belongsTo(Product);

async function checkAccount19() {
    try {
        await sequelize.authenticate();
        console.log("DB Connected.");

        const orders = await Order.findAll({
            where: { AccountId: 19 },
            include: [Product]
        });

        console.log(`Found ${orders.length} orders for Account 19:`);
        orders.forEach(o => {
            console.log(`- ID: ${o.id} | Product: ${o.Product ? o.Product.name : 'NULL'} | Qty: ${o.quantity} | Status: ${o.status} | Price: ${o.priceAtOrder} | SubItems: ${o.subItemsData}`);
        });

    } catch (e) {
        console.error(e);
    }
}

checkAccount19();
