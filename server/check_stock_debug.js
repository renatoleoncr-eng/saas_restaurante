const { Product, ProductVariant } = require('./models');

async function checkStock() {
    try {
        const cerveza = await Product.findOne({ where: { name: 'Cerveza' }, include: [ProductVariant] });
        const coca = await Product.findOne({ where: { name: 'Coca Cola' }, include: [ProductVariant] });

        console.log('=== CERVEZA ===');
        if (cerveza) {
            console.log(`ID: ${cerveza.id}, Stock: ${cerveza.stock}, Managed: ${cerveza.isStockManaged}`);
            console.log('Variants:', JSON.stringify(cerveza.ProductVariants, null, 2));
        } else {
            console.log('Not Found');
        }

        console.log('\n=== COCA COLA ===');
        if (coca) {
            console.log(`ID: ${coca.id}, Stock: ${coca.stock}, Managed: ${coca.isStockManaged}`);
            console.log('Variants:', JSON.stringify(coca.ProductVariants, null, 2));
        } else {
            console.log('Not Found');
        }
    } catch (e) {
        console.error(e);
    }
}

checkStock();
