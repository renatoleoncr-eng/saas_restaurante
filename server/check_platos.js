const { Product, Recipe, Ingredient } = require('./models');
(async () => {
    try {
        const products = await Product.findAll({
            where: { type: 'dish' },
            include: [{ model: Recipe, include: [Ingredient] }]
        });
        let count = 0;
        console.log("Found", products.length, "dishes totally.");
        products.forEach(p => {
            if (p.Recipes && p.Recipes.length > 0) {
                console.log('Plato:', p.name);
                p.Recipes.forEach(r => console.log('  Recipe ID', r.id, 'Ingredient:', r.Ingredient ? r.Ingredient.name : 'MISSING!'));
                count++;
            }
        });
        console.log('Found', count, 'dishes with recipes.');
        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
})();
