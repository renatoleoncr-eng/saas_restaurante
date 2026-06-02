const { Recipe, sequelize } = require('./models');

async function clearRecipes() {
    try {
        await sequelize.authenticate();
        const count = await Recipe.destroy({ where: {} });
        console.log(`Borradas ${count} recetas.`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
clearRecipes();
