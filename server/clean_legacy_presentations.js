const { Product } = require('./models');

async function cleanLegacyPresentations() {
    try {
        console.log("=== INICIANDO LIMPIEZA DE VARIANTES ANTIGUAS (JSON) ===");

        // Find all products that have something in the presentations field
        const products = await Product.findAll();

        let cleanedCount = 0;

        for (const p of products) {
            const hasLegacyData = p.presentations && p.presentations !== '[]' && p.presentations !== 'null';

            if (hasLegacyData) {
                // Wipe the legacy column to enforce only relational variants
                p.presentations = '[]';
                await p.save();
                cleanedCount++;
                console.log(`- Limpiada la ruta antigua para el producto ID ${p.id}: ${p.name}`);
            }
        }

        console.log(`--------------------------------------------------`);
        console.log(`Limpieza completada con éxito. Se sanearon y actualizaron ${cleanedCount} productos.`);
        console.log(`A partir de ahora, todo el sistema usará exclusivamente la ruta nueva Relacional.`);

        process.exit(0);
    } catch (err) {
        console.error("Error durante la limpieza:", err);
        process.exit(1);
    }
}

cleanLegacyPresentations();
