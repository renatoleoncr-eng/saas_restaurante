const { getModels } = require('./models');

(async () => {
    try {
        const models = await getModels();
        const menu = await models.DailyMenu.findOne({ order: [['id', 'DESC']] });
        if (!menu) {
            console.log("No menu found");
            process.exit(0);
        }

        console.log("=== CURRENT DAILY MENU ===");
        console.log("Date:", menu.date);

        const entries = JSON.parse(menu.entries || '[]');
        console.log("\n--- ENTRIES ---");
        entries.forEach(e => {
            console.log(`- ID: ${e.id} | Name: ${e.name} | Stock: ${e.stock} | LinkId: ${e.linkId}`);
        });

        const mains = JSON.parse(menu.mains || '[]');
        console.log("\n--- MAINS ---");
        mains.forEach(m => {
            console.log(`- ID: ${m.id} | Name: ${m.name} | Stock: ${m.stock} | LinkId: ${m.linkId}`);
        });

        console.log("\nDone.");
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
})();
