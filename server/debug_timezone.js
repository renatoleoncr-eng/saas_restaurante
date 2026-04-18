const { Account, Order, Product } = require('./models');
const { Op } = require('sequelize');

async function debugDateRange() {
    try {
        console.log('\n🔍 Debugging Date Range Issue\n');

        // Simulate what the backend does
        const startDateStr = '2026-02-13';
        const endDateStr = '2026-02-13';

        let start = new Date(startDateStr);
        start.setHours(0, 0, 0, 0);
        let end = new Date(endDateStr);
        end.setHours(23, 59, 59, 999);

        console.log(`📅 Date Range (as backend processes it):`);
        console.log(`  Start: ${start.toISOString()}`);
        console.log(`  End: ${end.toISOString()}`);
        console.log(`  Start Local: ${start.toString()}`);
        console.log(`  End Local: ${end.toString()}\n`);

        // Find closed accounts in this range
        const closedAccounts = await Account.findAll({
            where: {
                status: 'closed',
                closedAt: {
                    [Op.between]: [start, end]
                }
            },
            include: [{ model: Order, include: [Product] }]
        });

        console.log(`✅ Found ${closedAccounts.length} closed accounts in this range\n`);

        // Now check ALL closed accounts and their closedAt timestamps
        const allClosed = await Account.findAll({
            where: { status: 'closed' },
            order: [['closedAt', 'DESC']],
            limit: 5
        });

        console.log(`📋 Recent closed accounts (checking timestamps):\n`);
        allClosed.forEach(acc => {
            console.log(`  Account #${acc.id}`);
            console.log(`    ClosedAt: ${acc.closedAt}`);
            console.log(`    ClosedAt ISO: ${acc.closedAt.toISOString()}`);
            console.log(`    Total: S/ ${acc.total}`);
            console.log('');
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

debugDateRange();
