const { Account, Order, Payment } = require('./models');

async function check() {
    try {
        const accounts = await Account.findAll({
            where: { status: 'open' },
            include: [{ model: Order }]
        });
        console.log(`Open accounts: ${accounts.length}`);
        accounts.forEach(acc => {
            console.log(`Account ID: ${acc.id}, customerName: ${acc.customerName}, clientDni: ${acc.clientDni}, status: ${acc.status}, total: ${acc.total}`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
