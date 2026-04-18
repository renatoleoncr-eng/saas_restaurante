const { DailyMenu } = require('./models');

async function addIdsToExistingMenus() {
    try {
        const generateId = () => `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const menus = await DailyMenu.findAll();

        for (const menu of menus) {
            let entries = JSON.parse(menu.entries || '[]');
            let mains = JSON.parse(menu.mains || '[]');
            let updated = false;

            // Add IDs to entries
            entries = entries.map(entry => {
                if (!entry.id) {
                    updated = true;
                    return { ...entry, id: generateId() };
                }
                return entry;
            });

            // Add IDs to mains
            mains = mains.map(main => {
                if (!main.id) {
                    updated = true;
                    return { ...main, id: generateId() };
                }
                return main;
            });

            if (updated) {
                menu.entries = JSON.stringify(entries);
                menu.mains = JSON.stringify(mains);
                await menu.save();
                console.log(`✓ Updated menu for ${menu.date}`);
            } else {
                console.log(`- Menu for ${menu.date} already has IDs`);
            }
        }

        console.log('\n✅ Migration complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

addIdsToExistingMenus();
