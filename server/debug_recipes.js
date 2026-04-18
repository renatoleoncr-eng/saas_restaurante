const { Product, Recipe, Ingredient } = require('./models');
const sequelize = require('./config/db');

async function checkRecipes() {
    try {
        await sequelize.authenticate();
        console.log('DB Connection OK');

        const products = await Product.findAll({
            where: {
                name: ['Arroz con Pollo', 'Chicharron Pota', 'Ceviche Mero', 'Pieza Pollo']
            },
            include: [{ model: Recipe, include: [Ingredient] }]
        });

        for (const p of products) {
            console.log(`\nProduct: ${p.id} - ${p.name}`);
            console.log(`Presentations JSON: ${p.presentations}`);
            if (p.Recipes && p.Recipes.length > 0) {
                p.Recipes.forEach(r => {
                    console.log(` - Recipe ID: ${r.id}, Pres: "${r.presentation}", Ingredient: ${r.Ingredient ? r.Ingredient.name : 'NULL'}, Qty: ${r.quantity}`);
                });
            } else {
                console.log(' - No Recipes found.');
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}

checkRecipes();
