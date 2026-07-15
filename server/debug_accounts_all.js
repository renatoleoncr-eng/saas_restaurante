const { Account, Order, Payment } = require('./models');

async function debug() {
    try {
        const accounts = await Account.findAll({
            order: [['id', 'DESC']],
            limit: 20
        });
        console.log("Recent Accounts:", accounts.map(a => a.id).join(', '));
        
        // Find if any account has ID 781 or 783
        const acc781 = await Account.findByPk(781);
        const acc783 = await Account.findByPk(783);
        console.log("Acc 781:", !!acc781, "Acc 783:", !!acc783);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

debug();
