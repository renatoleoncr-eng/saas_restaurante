const { Product, ProductVariant, Recipe, Ingredient, Op } = require('./models');
const sequelize = require('./config/db');

async function check() {
    try {
        const coca = await Product.findOne({
            where: { name: { [Op.like]: '%Coca Cola%' } },
            include: [ProductVariant, Recipe]
        });

        if (!coca) {
            console.log("Coca Cola not found");
            return;
        }

        console.log(`Product: ${coca.name} (ID: ${coca.id})`);
        console.log(`Stock: ${coca.stock}`);
        console.log(`Managed: ${coca.isStockManaged}`);
        console.log(`Variants: ${coca.ProductVariants.length}`);
        coca.ProductVariants.forEach(v => {
            console.log(` - Variant: ${v.name}, Stock: ${v.stock}, ID: ${v.id}`);
        });
        console.log(`Recipes: ${coca.Recipes.length}`);
        coca.Recipes.forEach(r => {
            console.log(` - Recipe: ${r.name}, Pres: ${r.presentation}`);
        });

    } catch (e) {
        console.error(e);
    }
}

check();
