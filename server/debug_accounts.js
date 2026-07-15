const { Account, Order, Payment, Table } = require('./models');

async function debug() {
    try {
        const accounts = await Account.findAll({
            where: { id: [781, 783] },
            include: [Order, Payment, Table]
        });
        console.log(JSON.stringify(accounts, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

debug();
