const sequelize = require('./config/db');
const { 
    Table, Account, Order, Payment, Expense, CashSession, 
    Invoice, AuditLog, IngredientMovement, ProductMovement, 
    Attendance, Reservation, QrAccount 
} = require('./models');

async function clearData() {
    try {
        console.log("Starting operational data cleanup...");

        // Disable foreign key checks
        const isMysql = sequelize.options.dialect === 'mysql';
        if (isMysql) {
            await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        } else {
            await sequelize.query('PRAGMA foreign_keys = OFF');
        }

        // Deleting operational data using DELETE FROM (via destroy) to avoid foreign key truncate locks
        console.log("Clearing ProductMovements...");
        await ProductMovement.destroy({ where: {}, force: true });

        console.log("Clearing IngredientMovements...");
        await IngredientMovement.destroy({ where: {}, force: true });

        console.log("Clearing Payments...");
        await Payment.destroy({ where: {}, force: true });

        console.log("Clearing Invoices...");
        await Invoice.destroy({ where: {}, force: true });

        console.log("Clearing Orders...");
        await Order.destroy({ where: {}, force: true });

        console.log("Clearing Accounts...");
        await Account.destroy({ where: {}, force: true });

        console.log("Clearing Expenses...");
        await Expense.destroy({ where: {}, force: true });

        console.log("Clearing CashSessions...");
        await CashSession.destroy({ where: {}, force: true });

        console.log("Clearing AuditLogs...");
        await AuditLog.destroy({ where: {}, force: true });

        console.log("Clearing Attendances...");
        await Attendance.destroy({ where: {}, force: true });

        console.log("Clearing Reservations...");
        await Reservation.destroy({ where: {}, force: true });

        // Reset Table statuses to 'free'
        console.log("Resetting Table statuses to 'free'...");
        await Table.update({ status: 'free' }, { where: {} });

        // Reset QrAccount accumulated_month_sum to 0
        console.log("Resetting QrAccount accumulated month sums...");
        await QrAccount.update({ accumulated_month_sum: 0, accumulated_month_key: null }, { where: {} });

        // Re-enable foreign key checks
        if (isMysql) {
            await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        } else {
            await sequelize.query('PRAGMA foreign_keys = ON');
        }

        console.log("Operational data cleared successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Error clearing operational data:", error);
        process.exit(1);
    }
}

clearData();
