const { Product } = require('./models');

async function checkTypes() {
    try {
        const products = await Product.findAll();
        const types = {};
        products.forEach(p => {
            types[p.type] = (types[p.type] || 0) + 1;
        });
        console.log(types);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkTypes();
