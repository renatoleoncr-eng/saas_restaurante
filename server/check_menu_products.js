const { Product } = require('./models');

async function checkMenuProducts() {
    try {
        const menus = await Product.findAll({ where: { type: 'menu' } });
        console.log(`\nFound ${menus.length} menu products:\n`);
        menus.forEach(m => {
            console.log(`  ID: ${m.id} | Name: "${m.name}" | Price: ${m.price}`);
        });

        if (menus.length === 0) {
            console.log('\n⚠️  NO MENU PRODUCTS FOUND IN DATABASE!');
            console.log('This is the root cause of the problem.');
            console.log('The frontend is trying to use virtual menu products that don\'t exist in the database.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkMenuProducts();
