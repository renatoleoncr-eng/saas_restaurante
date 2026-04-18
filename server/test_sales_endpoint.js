const { Order, Product, Account, Table } = require('./models');

async function testNewSalesEndpoint() {
    try {
        console.log('\n🔍 Testing New Sales Endpoint Logic\n');

        const productWhere = { type: 'dish' };

        // First, get orders with Product and Account (no nested Table)
        const orders = await Order.findAll({
            include: [
                {
                    model: Product,
                    attributes: ['name', 'type'],
                    where: productWhere,
                    required: true
                },
                {
                    model: Account,
                    attributes: ['id', 'customerName', 'TableId'],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: 10
        });

        console.log(`✅ Found ${orders.length} orders`);

        // Manually fetch Table names for each account
        const tableIds = [...new Set(orders.map(o => o.Account?.TableId).filter(Boolean))];
        console.log(`📋 Unique TableIds: ${tableIds.join(', ')}`);

        const tables = await Table.findAll({
            where: { id: tableIds },
            attributes: ['id', 'number']
        });

        console.log(`🪑 Found ${tables.length} tables`);

        const tableMap = {};
        tables.forEach(t => {
            tableMap[t.id] = t.number;
        });

        // Add table names to the response
        const ordersWithTables = orders.map(order => {
            const orderJSON = order.toJSON();
            if (orderJSON.Account && orderJSON.Account.TableId) {
                orderJSON.Account.Table = {
                    name: tableMap[orderJSON.Account.TableId] || 'N/A'
                };
            }
            return orderJSON;
        });

        console.log('\n📦 Sample Orders:');
        ordersWithTables.slice(0, 3).forEach(order => {
            console.log(`  ${order.id} | ${order.Product?.name} | Mesa: ${order.Account?.Table?.name || 'N/A'} | Cliente: ${order.Account?.customerName || 'N/A'}`);
        });

        console.log('\n✅ Success! Endpoint logic works.\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testNewSalesEndpoint();
