const axios = require('axios');

async function testReportsEndpoint() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const url = `http://localhost:5174/api/reports/daily?startDate=${today}&endDate=${today}`;

        console.log(`\n🔍 Testing Reports Endpoint`);
        console.log(`URL: ${url}\n`);

        const response = await axios.get(url);
        const data = response.data;

        console.log('📊 Response:');
        console.log(`  Total Sales: S/ ${data.totalSales}`);
        console.log(`  Total Expenses: S/ ${data.totalExpenses}`);
        console.log(`  Balance: S/ ${data.balance}`);
        console.log(`  Current Cash Balance: S/ ${data.currentCashBalance}`);
        console.log(`  Total Pending: S/ ${data.totalPending}`);
        console.log(`  Closed Accounts: ${data.closedCount}`);
        console.log(`  Open Accounts: ${data.openCount}`);
        console.log(`\n✅ Endpoint is working!\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        process.exit(1);
    }
}

testReportsEndpoint();
