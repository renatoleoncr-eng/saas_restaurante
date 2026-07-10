const { Product } = require('./models');

async function run() {
    try {
        await Product.destroy({
            where: { id: [228, 229, 230], TenantId: 1 }
        });
        console.log("Deleted duplicates.");
    } catch(e) {
        console.error("Error:", e);
    }
}
run();
