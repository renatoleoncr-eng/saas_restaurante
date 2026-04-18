const { Product } = require('./models');

async function testMenuProducts() {
    try {
        console.log('\n🔍 Testing Menu Product Auto-Creation\n');

        // Simulate what happens when you save menu config with different groups
        const testGroups = [
            { name: 'Menú del Día', price: 14.00 },
            { name: 'Menú Ejecutivo', price: 18.00 },
            { name: 'Menú Premium', price: 25.00 }
        ];

        console.log('📝 Simulating menu save with these groups:');
        testGroups.forEach(g => console.log(`   - ${g.name} (S/ ${g.price})`));

        console.log('\n🔄 Creating/Updating products...\n');

        for (const group of testGroups) {
            const [prod, wasCreated] = await Product.findOrCreate({
                where: { name: group.name },
                defaults: {
                    name: group.name,
                    price: group.price,
                    type: 'menu',
                    stock: 0,
                    isStockManaged: false,
                    category: 'menu'
                }
            });

            if (wasCreated) {
                console.log(`   ✅ Created: ${prod.name} (ID: ${prod.id}) - S/ ${prod.price}`);
            } else {
                console.log(`   ℹ️  Already exists: ${prod.name} (ID: ${prod.id}) - S/ ${prod.price}`);
                if (parseFloat(prod.price) !== parseFloat(group.price)) {
                    prod.price = group.price;
                    await prod.save();
                    console.log(`      Updated price to S/ ${group.price}`);
                }
            }
        }

        console.log('\n📊 Current menu products in database:\n');
        const menuProducts = await Product.findAll({
            where: { type: 'menu' },
            order: [['id', 'ASC']]
        });

        menuProducts.forEach(p => {
            console.log(`   ${p.id.toString().padStart(3)} | ${p.name.padEnd(20)} | S/ ${p.price.toString().padStart(6)} | Type: ${p.type}`);
        });

        console.log('\n✅ Test completed successfully!');
        console.log('\n💡 These products will be:');
        console.log('   - Available in POS for creating orders');
        console.log('   - Hidden from Terminados and Preparados tabs');
        console.log('   - Managed via Configurar Menú interface\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

testMenuProducts();
