const { Account, Order, Product } = require('./models');
const { Op } = require('sequelize');

async function debugCashRegister() {
    try {
        console.log('\n🔍 Debugging Cash Register Issue\n');

        // Get today's date range
        let start = new Date();
        start.setHours(0, 0, 0, 0);
        let end = new Date();
        end.setHours(23, 59, 59, 999);

        console.log(`📅 Date Range: ${start.toISOString()} to ${end.toISOString()}\n`);

        // Find closed accounts today
        const closedAccounts = await Account.findAll({
            where: {
                status: 'closed',
                closedAt: {
                    [Op.between]: [start, end]
                }
            },
            include: [{ model: Order, include: [Product] }]
        });

        console.log(`✅ Found ${closedAccounts.length} closed accounts today\n`);

        if (closedAccounts.length === 0) {
            console.log('⚠️  No closed accounts today. Checking all closed accounts...\n');

            const allClosed = await Account.findAll({
                where: { status: 'closed' },
                include: [{ model: Order, include: [Product] }],
                order: [['closedAt', 'DESC']],
                limit: 5
            });

            console.log(`Found ${allClosed.length} recent closed accounts:\n`);
            allClosed.forEach(acc => {
                const ordersTotal = acc.Orders.reduce((sum, o) => sum + (o.priceAtOrder * o.quantity), 0);
                console.log(`  Account #${acc.id} (${acc.customerName})`);
                console.log(`    Closed: ${acc.closedAt}`);
                console.log(`    Total field: S/ ${acc.total}`);
                console.log(`    Calculated from orders: S/ ${ordersTotal.toFixed(2)}`);
                console.log(`    Orders: ${acc.Orders.length}`);
                console.log(`    Payment Method: ${acc.paymentMethod || 'N/A'}`);
                console.log('');
            });
        } else {
            closedAccounts.forEach(acc => {
                const ordersTotal = acc.Orders.reduce((sum, o) => sum + (o.priceAtOrder * o.quantity), 0);
                console.log(`  Account #${acc.id} (${acc.customerName})`);
                console.log(`    Total field: S/ ${acc.total}`);
                console.log(`    Calculated from orders: S/ ${ordersTotal.toFixed(2)}`);
                console.log(`    Orders: ${acc.Orders.length}`);
                console.log(`    Payment Method: ${acc.paymentMethod || 'N/A'}`);
                console.log('');
            });
        }

        const totalSales = closedAccounts.reduce((sum, acc) => sum + parseFloat(acc.total || 0), 0);
        console.log(`💰 Total Sales (from total field): S/ ${totalSales.toFixed(2)}\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

debugCashRegister();
