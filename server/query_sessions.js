const { CashSession } = require('./models');

async function getSessions() {
    try {
        const sessions = await CashSession.findAll({
            order: [['id', 'DESC']],
            limit: 5
        });
        console.log(JSON.stringify(sessions, null, 2));
    } catch (err) {
        console.error(err);
    }
}

getSessions();
