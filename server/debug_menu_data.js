const { DailyMenu } = require('./models');
const sequelize = require('./config/db');

async function checkDailyMenu() {
    try {
        await sequelize.authenticate();
        console.log('DB Connection OK');

        const today = new Date().toLocaleDateString('en-CA');
        console.log('Querying for date:', today);

        const menu = await DailyMenu.findOne({
            where: { date: today }
        });

        if (menu) {
            console.log('--- Daily Menu Found ---');
            console.log('Entries:');
            const entries = JSON.parse(menu.entries || '[]');
            console.log(JSON.stringify(entries, null, 2));

            console.log('Mains (Segundos):');
            const mains = JSON.parse(menu.mains || '[]');
            console.log(JSON.stringify(mains, null, 2));

        } else {
            console.log('No Daily Menu found for today.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}

checkDailyMenu();
