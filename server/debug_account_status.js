const { Account, Table, Payment, AuditLog, Area } = require('./models');
const { Op } = require('sequelize');

async function run() {
    console.log("=== ACCOUNT 257 DETAILS ===");
    const acc257 = await Account.findByPk(257, { include: [Table] });
    if (acc257) {
        console.log(`ID: ${acc257.id} | Table ID: ${acc257.TableId} | Number: ${acc257.Table ? acc257.Table.number : 'NULL'} | Status: ${acc257.status} | Total: ${acc257.total} | CreatedAt: ${acc257.createdAt}`);
    } else {
        console.log("Account 257 not found");
    }

    console.log("\n=== PAYMENTS FOR ACCOUNT 257 ===");
    const payments = await Payment.findAll({ where: { AccountId: 257 } });
    console.log(`Found ${payments.length} payments`);
    payments.forEach(p => {
        console.log(`Payment ID: ${p.id} | Amount: ${p.amount} | Method: ${p.method} | CreatedAt: ${p.createdAt}`);
    });

    console.log("\n=== AUDIT LOGS FOR ACCOUNT 257 OR TABLE 30 ===");
    const logs = await AuditLog.findAll({
        where: {
            [Op.or]: [
                { entity: 'Account', entityId: '257' },
                { entity: 'Table', entityId: '30' }
            ]
        },
        order: [['createdAt', 'ASC']]
    });
    logs.forEach(l => {
        console.log(`Log ID: ${l.id} | Action: ${l.action} | Model: ${l.modelName} | Record: ${l.recordId} | Details: ${l.details} | CreatedAt: ${l.createdAt}`);
    });

    console.log("\n=== OPEN ACCOUNTS & TABLE STATUSES ===");
    const openAccounts = await Account.findAll({
        where: { status: 'open' },
        include: [{ model: Table, include: [Area] }]
    });
    openAccounts.forEach(a => {
        const tableInfo = a.Table ? `Table ID: ${a.Table.id} | Number: ${a.Table.number} | Area: ${a.Table.Area ? a.Table.Area.name : 'NULL'} | TableStatus: ${a.Table.status}` : 'No Table';
        console.log(`Account ID: ${a.id} | AccStatus: ${a.status} | ${tableInfo} | Total: ${a.total} | CreatedAt: ${a.createdAt}`);
    });
}
run();
