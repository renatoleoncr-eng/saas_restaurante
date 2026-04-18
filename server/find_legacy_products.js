const { Product, ProductVariant } = require('./models');

async function checkLegacyProducts() {
    try {
        console.log("=== ESCANEANDO PLATOS ANTIGUOS (LEGACY JSON) ===");
        const products = await Product.findAll({
            include: [ProductVariant]
        });

        let legacyCount = 0;

        products.forEach(p => {
            // Very loose check: anything in presentations that isn't null/empty
            const hasSomethingInPresentations = p.presentations && p.presentations !== '[]' && p.presentations !== 'null';
            const hasNoRelationalVariants = !p.ProductVariants || p.ProductVariants.length === 0;

            if (hasSomethingInPresentations) {
                legacyCount++;
                console.log(`- ID: ${p.id} | Nombre: ${p.name} | RelationalQty: ${p.ProductVariants ? p.ProductVariants.length : 0}`);
                console.log(`  Raw presentations string: "${p.presentations}"`);
                console.log('--------------------------------------------------');
            }
        });

        console.log(`\nEscaneo completado. Se encontraron ${legacyCount} productos usando el sistema antiguo.`);
        process.exit(0);
    } catch (err) {
        console.error("Error escaneando la base de datos:", err);
        process.exit(1);
    }
}

checkLegacyProducts();
