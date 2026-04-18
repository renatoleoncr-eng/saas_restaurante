const { Product, ProductVariant } = require('./models');

async function fixVariantStock() {
    try {
        console.log('\n🔧 Fixing Variant Stock (Removing Duplicate Deductions)\n');

        // Find products with variants
        const products = await Product.findAll({
            include: [{ model: ProductVariant }],
            where: { isStockManaged: true }
        });

        for (const product of products) {
            if (product.ProductVariants && product.ProductVariants.length > 0) {
                console.log(`\n${product.name}:`);
                console.log(`  Base stock: ${product.stock}`);
                product.ProductVariants.forEach(v => {
                    console.log(`  ${v.name}: ${v.stock}`);
                });

                const totalVariantStock = product.ProductVariants.reduce((sum, v) => sum + v.stock, 0);
                console.log(`  Total variant stock: ${totalVariantStock}`);
                console.log(`  Displayed stock (frontend): ${product.stock + totalVariantStock}`);

                // Reset base stock to 0 if it has variants
                // Because frontend sums base + variants, base should be 0
                if (product.stock !== 0) {
                    console.log(`  ⚠️  Base stock should be 0 (has variants, stock managed via variants)`);
                    console.log(`  Setting base stock from ${product.stock} to 0`);
                    product.stock = 0;
                    await product.save();
                    console.log(`  ✅ Fixed`);
                }
            }
        }

        console.log('\n✅ Variant stock fix completed\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixVariantStock();
