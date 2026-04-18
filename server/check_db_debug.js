const { Product, Ingredient, DailyMenu, Area } = require('./models');

async function checkDB() {
    try {
        const prodCount = await Product.count();
        const ingCount = await Ingredient.count();
        const menuCount = await DailyMenu.count();
        const areaCount = await Area.count();

        console.log({
            prodCount,
            ingCount,
            menuCount,
            areaCount
        });

        if (prodCount > 0) {
            const sample = await Product.findOne();
            console.log("Sample Product:", sample.name);
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkDB();
