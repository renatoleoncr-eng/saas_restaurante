const { sequelize, Attendance } = require('./models');

const run = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected.');

        // Sync Attendance table explicitly
        await Attendance.sync({ force: true });
        console.log('Attendance table synced.');

    } catch (err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
};

run();
