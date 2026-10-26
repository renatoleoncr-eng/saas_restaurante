const { Tenant, sequelize } = require('../models');
const syncDB = require('../sync');
const express = require('express');
const http = require('http');

async function testPerformanceEndpoint() {
    let server;
    try {
        console.log("=== Testing Performance Endpoint ===");
        await syncDB();
        console.log("Database synced and connected successfully:", sequelize.getDialect());

        let tenant = await Tenant.findOne();
        if (!tenant) {
            console.log("No tenant found, creating mock tenant for test");
            tenant = await Tenant.create({
                name: "Test Restaurant",
                slug: "test-restaurante",
                ownerEmail: "owner@test.com",
                plan: "pago",
                status: "active"
            });
        }
        console.log("Using Tenant:", tenant.id, tenant.name, tenant.slug);

        const app = express();
        app.use(express.json());

        // Mock tenant & auth middleware
        app.use((req, res, next) => {
            req.tenant = tenant;
            req.user = { id: 1, role: 'admin', username: 'admin' };
            next();
        });

        const performanceRoutes = require('../routes/performance.routes');
        app.use('/api', performanceRoutes);

        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, resolve));
        const port = server.address().port;
        const baseUrl = `http://127.0.0.1:${port}`;
        console.log(`Server listening on ${baseUrl}`);

        // 1. Test full month request
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        console.log(`Sending GET /api/performance/stats?year=${currentYear}&month=${currentMonth}...`);
        const r1 = await fetch(`${baseUrl}/api/performance/stats?year=${currentYear}&month=${currentMonth}`);
        if (!r1.ok) {
            const errText = await r1.text();
            throw new Error(`HTTP ${r1.status}: ${errText}`);
        }

        const data1 = await r1.json();
        console.log("Response success:", data1.success);
        console.log("Filter:", data1.filter);
        console.log("KPIs:", data1.kpis);
        console.log("Available Years:", data1.availableYears);
        console.log("Evolution months count:", data1.evolution?.length);
        console.log("Daily comparison days count:", data1.dailyComparison?.length);
        console.log("Daily volume data count:", data1.dailyVolumeData?.length);
        console.log("Top tables count:", data1.topTables?.length);
        console.log("Top products count:", data1.topProducts?.length);
        console.log("Payment methods count:", data1.paymentMethods?.length);
        console.log("User productivity byOrders count:", data1.userProductivity?.byOrders?.length);
        console.log("User productivity byPayments count:", data1.userProductivity?.byPayments?.length);

        if (!data1.success) throw new Error("success should be true");
        if (data1.evolution?.length !== 12) throw new Error("evolution should have 12 months");
        if (!data1.kpis || typeof data1.kpis.ingresos !== 'number') throw new Error("KPIs missing or malformed");

        // 2. Test 1st fortnight range (startDay=1, endDay=15)
        console.log(`\nSending GET /api/performance/stats?year=${currentYear}&month=${currentMonth}&startDay=1&endDay=15...`);
        const r2 = await fetch(`${baseUrl}/api/performance/stats?year=${currentYear}&month=${currentMonth}&startDay=1&endDay=15`);
        if (!r2.ok) {
            const errText = await r2.text();
            throw new Error(`HTTP ${r2.status}: ${errText}`);
        }

        const data2 = await r2.json();
        console.log("Fortnight volume data count (should be 15):", data2.dailyVolumeData?.length);
        if (data2.dailyVolumeData?.length !== 15) throw new Error("Fortnight dailyVolumeData should have 15 days");

        console.log("\n✅ ALL PERFORMANCE ENDPOINT TESTS PASSED SUCCESSFULLY!");
        server.close();
    } catch (err) {
        console.error("\n❌ Performance test failed:", err);
        if (server) server.close();
        process.exit(1);
    }
}

testPerformanceEndpoint();
