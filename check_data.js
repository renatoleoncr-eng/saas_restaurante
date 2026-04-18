const { sequelize, Product, Table, Area, DailyMenu, Ingredient } = require('./server/models');

async function checkData() {
    try {
        await sequelize.authenticate();
        console.log("DB Connection OK.");

        const pCount = await Product.count();
        const tCount = await Table.count();
        const aCount = await Area.count();
        const mCount = await DailyMenu.count();
        const iCount = await Ingredient.count();

        console.log("--- ROW COUNTS ---");
        console.log(`Products: ${pCount}`);
        console.log(`Tables: ${tCount}`);
        console.log(`Areas: ${aCount}`);
        console.log(`DailyMenus: ${mCount}`);
        console.log(`Ingredients: ${iCount}`);

    } catch (err) {
        console.error("DB Error:", err);
    } finally {
        await sequelize.close();
    }
}

checkData();
