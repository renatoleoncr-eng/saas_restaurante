const { Product, ProductVariant } = require('./models');

async function checkCeviche() {
    try {
        const variants = await ProductVariant.findAll({
            include: [Product],
            paranoid: false
        });
        const ceviches = variants.filter(v =>
            v.name.toLowerCase().includes('ceviche') ||
            (v.Product && v.Product.name.toLowerCase().includes('ceviche'))
        );
        console.log(JSON.stringify(ceviches, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkCeviche();
