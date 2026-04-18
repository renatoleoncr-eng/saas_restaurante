const { Product, ProductMovement } = require('./models');

async function fixAguaSanMateo() {
    try {
        console.log('\n🔧 Fixing Agua San Mateo Stock\n');

        const agua = await Product.findOne({ where: { name: 'Agua San Mateo' } });

        if (!agua) {
            console.log('❌ Agua San Mateo not found');
            process.exit(1);
        }

        console.log(`Current stock: ${agua.stock}`);
        console.log('Expected stock: 8 (10 initial - 2 sold)');

        // Correct the stock
        const correctStock = 8;
        const adjustment = correctStock - agua.stock;

        console.log(`\nAdjustment needed: ${adjustment > 0 ? '+' : ''}${adjustment}`);

        agua.stock = correctStock;
        await agua.save();

        // Create a correction movement
        await ProductMovement.create({
            ProductId: agua.id,
            type: 'add',
            amount: Math.abs(adjustment),
            previousStock: agua.stock - adjustment,
            newStock: correctStock,
            reason: 'Corrección de stock inicial (debía ser 10, no 0)',
            userId: null
        });

        console.log(`✅ Stock corrected to ${correctStock}`);
        console.log('✅ Correction movement created\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixAguaSanMateo();
