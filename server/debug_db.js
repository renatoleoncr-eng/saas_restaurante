const { Account, Order, Table } = require('./models');
// Fixed imports

// const syncDB = require('./sync'); // Skip sync

async function checkData() {
    // await syncDB();

    console.log("--- Checking ACCOUNTS ---");
    const accounts = await Account.findAll();
    console.log(`Total Accounts: ${accounts.length}`);
    accounts.forEach(a => console.log(`ID: ${a.id} | Table: ${a.TableId} | Status: ${a.status} | Total: ${a.total}`));

    console.log("\n--- Checking KITCHEN QUERY ---");
    const { Op } = require('sequelize');
    try {
        const activeAccounts = await Account.findAll({
            where: { status: 'open' },
            include: [
                {
                    model: Order,
                    where: {
                        status: { [Op.not]: 'served' }
                    },
                    required: true,
                    include: [require('./models').Product] // Access Product via models
                },
                {
                    model: Table,
                    include: [require('./models').Area]
                }
            ],
            order: [['createdAt', 'ASC']]
        });
        console.log(`Kitchen Query Found: ${activeAccounts.length} accounts`);
        activeAccounts.forEach(a => {
            console.log(`Account ${a.id} Orders: ${a.Orders.length}`);
            console.log(`Table: ${a.Table ? a.Table.id : 'NULL'}`);
        });
    } catch (e) {
        console.error("Query Failed:", e);
    }
}

checkData();
