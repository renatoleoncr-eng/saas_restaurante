const { Area, RestaurantConfig } = require('./models');
const sequelize = require('./config/db');

async function testDB() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        const areas = await Area.findAll();
        console.log(`Found ${areas.length} areas.`);

        const config = await RestaurantConfig.findOne();
        console.log('Config found:', config ? 'Yes' : 'No');

    } catch (error) {
        console.error('Unable to connect to the database or query failed:', error);
    } finally {
        await sequelize.close();
    }
}

testDB();
