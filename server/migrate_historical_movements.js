require('dotenv').config();
const { ProductMovement, IngredientMovement, sequelize } = require('./models');

async function migrate() {
    console.log("Starting account ID migration for movements...");
    try {
        await sequelize.authenticate();
        console.log("Database connected.");
    } catch (err) {
        console.error("Unable to connect to the database:", err);
        process.exit(1);
    }

    // Pattern to match "(Cuenta #123)"
    const pattern = /\(Cuenta #(\d+)\)/;

    // 1. Process ProductMovements
    try {
        const productMovs = await ProductMovement.findAll();
        console.log(`Processing ${productMovs.length} ProductMovements...`);
        let pCount = 0;
        for (const mov of productMovs) {
            if (!mov.AccountId && mov.reason) {
                const match = mov.reason.match(pattern);
                if (match) {
                    mov.AccountId = parseInt(match[1]);
                    await mov.save();
                    pCount++;
                }
            }
        }
        console.log(`Updated ${pCount} ProductMovements.`);
    } catch (err) {
        console.error("Error processing ProductMovements:", err);
    }

    // 2. Process IngredientMovements
    try {
        const ingredientMovs = await IngredientMovement.findAll();
        console.log(`Processing ${ingredientMovs.length} IngredientMovements...`);
        let iCount = 0;
        for (const mov of ingredientMovs) {
            if (!mov.AccountId && mov.reason) {
                const match = mov.reason.match(pattern);
                if (match) {
                    mov.AccountId = parseInt(match[1]);
                    await mov.save();
                    iCount++;
                }
            }
        }
        console.log(`Updated ${iCount} IngredientMovements.`);
    } catch (err) {
        console.error("Error processing IngredientMovements:", err);
    }

    console.log("Migration finished.");
    process.exit(0);
}

migrate().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
