const { sequelize, Account, Order, Product, Expense, User, Payment } = require('./models');
const { Op } = require('sequelize');

async function debugReport() {
    try {
        console.log("--- DEBUGGING REPORT QUERY ---");

        // Use today's range
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);

        console.log(`Range: ${start.toISOString()} to ${end.toISOString()}`);

        console.log("\n1. Testing Payment.findAll...");
        try {
            const payments = await Payment.findAll({
                where: {
                    createdAt: {
                        [Op.between]: [start, end]
                    }
                },
                include: [
                    { model: User, attributes: ['username', 'displayName'] },
                    {
                        model: Account,
                        include: [
                            { model: Order, include: [Product] },
                            { model: Payment }
                        ]
                    }
                ]
            });
            console.log(`   Success! Found ${payments.length} payments.`);
        } catch (e) {
            console.error("   FAILED: Payment.findAll error:", e.message);
            console.error(e);
        }

        console.log("\n2. Testing Expense.findAll...");
        try {
            const expenses = await Expense.findAll({
                where: {
                    date: {
                        [Op.between]: [start, end]
                    }
                },
                include: [{ model: User, attributes: ['username', 'displayName'] }]
            });
            console.log(`   Success! Found ${expenses.length} expenses.`);
        } catch (e) {
            console.error("   FAILED: Expense.findAll error:", e.message);
            console.error(e);
        }

        console.log("\n3. Testing Global Cash Income (Payment.findAll with method: 'efectivo')...");
        try {
            const allCashPayments = await Payment.findAll({
                where: { method: 'efectivo' },
                attributes: ['amount']
            });
            console.log(`   Success! Found ${allCashPayments.length} cash payments.`);
        } catch (e) {
            console.error("   FAILED: Global Cash Income error:", e.message);
        }

        console.log("\n4. Testing Global Cash Outcome (Expense.findAll with paymentMethod: 'efectivo')...");
        try {
            const allCashExpenses = await Expense.findAll({
                where: { paymentMethod: 'efectivo' },
                attributes: ['amount']
            });
            console.log(`   Success! Found ${allCashExpenses.length} cash expenses.`);
        } catch (e) {
            console.error("   FAILED: Global Cash Outcome error:", e.message);
        }

    } catch (err) {
        console.error("CRITICAL ERROR in debug script:", err);
    } finally {
        process.exit();
    }
}

debugReport();
