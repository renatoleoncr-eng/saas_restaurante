const { Product } = require('./models');

async function checkCaseSensitivity() {
    try {
        const p1 = await Product.findOne({ where: { name: 'CEVICHE MERO' } });
        const p2 = await Product.findOne({ where: { name: 'ceviche mero' } });
        const p3 = await Product.findOne({ where: { name: 'Ceviche Mero' } });
        console.log('Search for CEVICHE MERO:', p1 ? 'Found' : 'Not Found');
        console.log('Search for ceviche mero:', p2 ? 'Found' : 'Not Found');
        console.log('Search for Ceviche Mero:', p3 ? 'Found' : 'Not Found');
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkCaseSensitivity();
