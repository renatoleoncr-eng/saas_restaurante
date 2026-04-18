const { DailyMenu, Product } = require('./models');

(async () => {
    try {
        console.log("Syncing Menu Groups to Products...");

        // Get recent menus
        const menus = await DailyMenu.findAll({
            order: [['date', 'DESC']],
            limit: 5
        });

        const uniqueGroups = {};

        menus.forEach(m => {
            const entries = JSON.parse(m.entries || '[]');
            const mains = JSON.parse(m.mains || '[]');
            const allItems = [...entries, ...mains];

            allItems.forEach(item => {
                if (item.groupName) {
                    uniqueGroups[item.groupName] = {
                        name: item.groupName,
                        price: item.menuPrice || 0
                    };
                }
            });
        });

        console.log("Found Groups:", Object.keys(uniqueGroups));

        for (const gName in uniqueGroups) {
            const gData = uniqueGroups[gName];

            const [prod, created] = await Product.findOrCreate({
                where: { name: gName },
                defaults: {
                    name: gName,
                    price: gData.price,
                    type: 'menu',
                    stock: 999,
                    isStockManaged: false,
                    description: 'Sincronizado desde Menús'
                }
            });

            if (created) {
                console.log(`[CREATED] Product: ${gName}`);
            } else {
                console.log(`[EXISTING] Product: ${gName} (ID: ${prod.id})`);
                if (prod.type !== 'menu') {
                    console.log(`  WARN: Product exists but type is '${prod.type}'`);
                }
            }
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit(0);
    }
})();
