const { Product } = require('./models');

async function listAllProducts() {
    try {
        const products = await Product.findAll({
            order: [['id', 'ASC']]
        });

        console.log(`\n📦 Total Products in Database: ${products.length}\n`);

        if (products.length === 0) {
            console.log('⚠️  NO PRODUCTS FOUND!');
            process.exit(0);
        }

        // Group by type
        const byType = {};
        products.forEach(p => {
            const type = p.type || 'undefined';
            if (!byType[type]) byType[type] = [];
            byType[type].push(p);
        });

        Object.keys(byType).forEach(type => {
            console.log(`\n=== ${type.toUpperCase()} (${byType[type].length}) ===`);
            byType[type].forEach(p => {
                console.log(`  ${p.id.toString().padStart(3)} | ${p.name.padEnd(30)} | Price: S/ ${p.price} | Stock: ${p.stock}`);
            });
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

listAllProducts();
