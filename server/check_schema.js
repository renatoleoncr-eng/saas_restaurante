const { sequelize } = require('./models');

async function checkSchema() {
    try {
        console.log("--- SCHEMA CHECK ---");

        const [accountsColumns] = await sequelize.query("DESCRIBE Accounts");
        console.log("\nAccounts Columns:");
        accountsColumns.forEach(c => console.log(`- ${c.Field} (${c.Type})`));

        const Tables = await sequelize.query("SHOW TABLES");
        const tableList = Tables[0].map(t => Object.values(t)[0]);
        console.log("\nExisting Tables:", tableList.join(', '));

        if (tableList.includes('DrinkPromotions')) {
            const [promoColumns] = await sequelize.query("DESCRIBE DrinkPromotions");
            console.log("\nDrinkPromotions Columns:");
            promoColumns.forEach(c => console.log(`- ${c.Field} (${c.Type})`));
        } else {
            console.log("\nWARNING: DrinkPromotions table MISSING!");
        }

        if (tableList.includes('DrinkPromotionItems')) {
            const [itemColumns] = await sequelize.query("DESCRIBE DrinkPromotionItems");
            console.log("\nDrinkPromotionItems Columns:");
            itemColumns.forEach(c => console.log(`- ${c.Field} (${c.Type})`));
        } else {
            console.log("\nWARNING: DrinkPromotionItems table MISSING!");
        }

        console.log("\n--- CHECK COMPLETE ---");
        process.exit(0);
    } catch (err) {
        console.error("Schema check failed:", err.message);
        process.exit(1);
    }
}

checkSchema();
