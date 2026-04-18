const { Product, ProductMovement } = require('./models');

async function debugStockIssues() {
    try {
        console.log('\n🔍 Debugging Stock and Movement Issues\n');

        // 1. Check Agua San Mateo
        console.log('=== AGUA SAN MATEO ===');
        const agua = await Product.findOne({ where: { name: 'Agua San Mateo' } });
        if (agua) {
            console.log(`ID: ${agua.id}`);
            console.log(`Type: ${agua.type}`);
            console.log(`Stock: ${agua.stock}`);
            console.log(`isStockManaged: ${agua.isStockManaged}`);

            const aguaMovements = await ProductMovement.findAll({
                where: { ProductId: agua.id },
                order: [['createdAt', 'DESC']],
                limit: 5
            });
            console.log(`\nRecent movements (${aguaMovements.length}):`);
            aguaMovements.forEach(m => {
                console.log(`  ${m.createdAt.toISOString()} | ${m.type} | Amount: ${m.amount} | Reason: ${m.reason || 'N/A'}`);
            });
        } else {
            console.log('NOT FOUND');
        }

        // 2. Check Ceviche Mero
        console.log('\n\n=== CEVICHE MERO ===');
        const ceviche = await Product.findOne({ where: { name: 'Ceviche Mero' } });
        if (ceviche) {
            console.log(`ID: ${ceviche.id}`);
            console.log(`Type: ${ceviche.type}`);
            console.log(`Stock: ${ceviche.stock}`);
            console.log(`isStockManaged: ${ceviche.isStockManaged}`);

            const cevicheMovements = await ProductMovement.findAll({
                where: { ProductId: ceviche.id },
                order: [['createdAt', 'DESC']],
                limit: 5
            });
            console.log(`\nRecent movements (${cevicheMovements.length}):`);
            cevicheMovements.forEach(m => {
                console.log(`  ${m.createdAt.toISOString()} | ${m.type} | Amount: ${m.amount} | Reason: ${m.reason || 'N/A'}`);
            });
        } else {
            console.log('NOT FOUND');
        }

        console.log('\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

debugStockIssues();
