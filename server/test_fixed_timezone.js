const { Account, Order, Product } = require('./models');
const { Op } = require('sequelize');

async function testFixedDateRange() {
    try {
        console.log('\n🔍 Testing Fixed Date Range Logic\n');

        // Simulate the FIXED backend logic
        const startDate = '2026-02-13';
        const endDate = '2026-02-13';

        // NEW LOGIC: Parse as local time
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59.999');

        console.log(`📅 Date Range (FIXED logic):`);
        console.log(`  Start: ${start.toISOString()}`);
        console.log(`  End: ${end.toISOString()}`);
        console.log(`  Start Local: ${start.toString()}`);
        console.log(`  End Local: ${end.toString()}\n`);

        // Find closed accounts
        const closedAccounts = await Account.findAll({
            where: {
                status: 'closed',
                closedAt: {
                    [Op.between]: [start, end]
                }
            },
            include: [{ model: Order, include: [Product] }]
        });

        console.log(`✅ Found ${closedAccounts.length} closed accounts\n`);

        const totalSales = closedAccounts.reduce((sum, acc) => sum + parseFloat(acc.total), 0);

        closedAccounts.forEach(acc => {
            console.log(`  Account #${acc.id} - ${acc.customerName}`);
            console.log(`    ClosedAt: ${acc.closedAt}`);
            console.log(`    Total: S/ ${acc.total}\n`);
        });

        console.log(`💰 Total Sales: S/ ${totalSales.toFixed(2)}\n`);

        if (totalSales > 0) {
            console.log('✅ SUCCESS! The fix works!\n');
        } else {
            console.log('❌ Still not working...\n');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testFixedDateRange();
