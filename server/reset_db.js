const { sequelize, Area, Table, Account, Product, ProductMovement, Order, Attendance, Reservation, Ingredient, IngredientMovement, Recipe, AuditLog, DailyMenu, Expense, ProductVariant, Payment } = require('./models');

async function resetDatabase() {
    try {
        console.log("Starting database reset...");

        // Disable foreign key checks for truncation (SQLite specific if using SQLite, but we use dialects. For MySQL/Postgres this is different, but destroyer with cascade is safer)

        // Destroy all operational data
        console.log("Destroying Order...");
        await Order.destroy({ where: {}, force: true });
        console.log("Destroying Payment...");
        await Payment.destroy({ where: {}, force: true });
        console.log("Destroying Account...");
        await Account.destroy({ where: {}, force: true });

        console.log("Destroying DailyMenu...");
        await DailyMenu.destroy({ where: {}, force: true });
        console.log("Destroying Recipe...");
        await Recipe.destroy({ where: {}, force: true });
        console.log("Destroying ProductMovement...");
        await ProductMovement.destroy({ where: {}, force: true });
        console.log("Destroying ProductVariant...");
        await ProductVariant.destroy({ where: {}, force: true });
        console.log("Destroying Product...");
        await Product.destroy({ where: {}, force: true });

        console.log("Destroying IngredientMovement...");
        await IngredientMovement.destroy({ where: {}, force: true });
        console.log("Destroying Ingredient...");
        await Ingredient.destroy({ where: {}, force: true });

        console.log("Destroying Reservation...");
        await Reservation.destroy({ where: {}, force: true });
        console.log("Destroying Table...");
        await Table.destroy({ where: {}, force: true });
        console.log("Destroying Area...");
        await Area.destroy({ where: {}, force: true });

        console.log("Destroying Expense...");
        await Expense.destroy({ where: {}, force: true });
        console.log("Destroying Attendance...");
        await Attendance.destroy({ where: {}, force: true });
        console.log("Destroying AuditLog...");
        await AuditLog.destroy({ where: {}, force: true });

        console.log("Database reset successfully! Users and Config have been preserved.");
    } catch (error) {
        console.error("Error resetting database:", error);
    } finally {
        await sequelize.close();
    }
}

resetDatabase();
