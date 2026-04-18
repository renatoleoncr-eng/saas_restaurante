const { DailyMenu } = require('./models');

(async () => {
    try {
        console.log("Listing ALL Daily Menus (Limit 5)...");

        const menus = await DailyMenu.findAll({
            order: [['date', 'DESC']],
            limit: 5
        });

        if (menus.length === 0) {
            console.log("No menus found in DB.");
        } else {
            menus.forEach(m => {
                console.log(`\n--- Date: ${m.date} ---`);
                const entries = JSON.parse(m.entries || '[]');
                const mains = JSON.parse(m.mains || '[]'); // Likely empty
                console.log(`Entries: ${entries.length}, Mains: ${mains.length}`);

                // Merge lists for checking
                const allItems = [...entries, ...mains];

                // Check for Menu Groups
                const groups = new Set();
                allItems.forEach(i => {
                    if (i.groupName) groups.add(i.groupName);
                });
                console.log("Groups found:", Array.from(groups));

                // Dump items with 'Menu' in name or groupName
                const menuItems = allItems.filter(i =>
                    (i.groupName && i.groupName.includes('Menu')) ||
                    (i.name && i.name.includes('Menu'))
                );
                // console.log("Menu Items:", JSON.stringify(menuItems, null, 2));
            });
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit(0);
    }
})();
