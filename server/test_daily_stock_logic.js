const { DailyMenu: Menu } = require('./models');
const sequelize = require('./config/db');

async function testDailyStockUpdate() {
    try {
        await sequelize.authenticate();
        console.log('DB Connection OK');

        const today = new Date().toLocaleDateString('en-CA');
        console.log(`Checking DailyMenu for date: ${today}`);

        const menu = await Menu.findOne({ where: { date: today } });
        if (!menu) {
            console.log('No menu found for today.');
            return;
        }

        console.log('Menu found ID:', menu.id);

        // Simulating the update logic
        // Let's assume we want to update Product ID 8 ("Arroz con Pollo" - Main) or 9 ("Chicharron" - Entry)
        // These IDs were seen in previous logs
        const targetIds = [8, 9];

        let entries = JSON.parse(menu.entries || '[]');
        let mains = JSON.parse(menu.mains || '[]');
        let updated = false;

        const updateList = (list, listName) => {
            list.forEach(item => {
                // Use loose comparison as linkId might be string or int
                if (targetIds.includes(Number(item.linkId))) {
                    console.log(`Found item in ${listName}: ${item.name} (ID: ${item.linkId})`);
                    console.log(`Current Stock: ${item.stock}`);

                    // Toggle stock to verify save
                    let currentStock = parseInt(item.stock || 0);
                    // Decrement for test, but keep it safe (don't go below 0)
                    // actually let's just subtract 1 to see if it persists
                    currentStock = Math.max(0, currentStock - 1);

                    item.stock = currentStock.toString();
                    console.log(`New Stock: ${item.stock}`);
                    updated = true;
                }
            });
        };

        updateList(entries, 'Entries');
        updateList(mains, 'Mains');

        if (updated) {
            menu.entries = JSON.stringify(entries);
            menu.mains = JSON.stringify(mains);
            await menu.save();
            console.log('DailyMenu saved successfully.');

            // Verification read
            const verifyMenu = await Menu.findByPk(menu.id);
            const verifyEntries = JSON.parse(verifyMenu.entries);
            const verifyMains = JSON.parse(verifyMenu.mains);

            const check = (list) => {
                list.forEach(item => {
                    if (targetIds.includes(Number(item.linkId))) {
                        console.log(`VERIFICATION: ${item.name} stock is now ${item.stock}`);
                    }
                });
            };
            check(verifyEntries);
            check(verifyMains);

        } else {
            console.log('No matching items found to update.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}

testDailyStockUpdate();
