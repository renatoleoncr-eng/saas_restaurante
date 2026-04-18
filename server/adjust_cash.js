const { Payment, Expense, Account, User, sequelize } = require('./models');

async function adjustCash() {
    try {
        const targetBalance = 212.80;
        console.log(`--- Ajuste de Caja a S/ ${targetBalance} ---`);

        // 1. Calculate Current Balance
        const allCashPayments = await Payment.findAll({
            where: { method: 'efectivo' },
            attributes: ['amount']
        });
        const totalCashIncome = allCashPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

        const allCashExpenses = await Expense.findAll({
            where: { paymentMethod: 'efectivo' },
            attributes: ['amount']
        });
        const totalCashOutcome = allCashExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

        const currentCashBalance = totalCashIncome - totalCashOutcome;
        console.log(`Saldo actual en efectivo: S/ ${currentCashBalance.toFixed(2)}`);

        const diff = targetBalance - currentCashBalance;

        if (Math.abs(diff) < 0.01) {
            console.log('✅ El saldo ya es correcto. No se requieren ajustes.');
            process.exit(0);
        }

        console.log(`Diferencia a ajustar: S/ ${diff.toFixed(2)}`);

        // Get an admin user for the transaction
        const admin = await User.findOne({ where: { role: 'admin' } });
        if (!admin) {
            console.error('❌ No se encontró un usuario administrador para realizar el ajuste.');
            process.exit(1);
        }

        if (diff > 0) {
            // Need to ADD cash (Income)
            // Create a dummy account for adjustments if it doesn't exist
            let [adjAccount] = await Account.findOrCreate({
                where: { customerName: 'Ajuste de Saldo Inicial' },
                defaults: {
                    status: 'closed',
                    total: diff,
                    openedAt: new Date(),
                    closedAt: new Date()
                }
            });

            await Payment.create({
                AccountId: adjAccount.id,
                amount: diff,
                method: 'efectivo',
                UserId: admin.id
            });
            console.log(`✅ Se ha creado un ingreso de ajuste por S/ ${diff.toFixed(2)}`);
        } else {
            // Need to REMOVE cash (Expense)
            await Expense.create({
                description: 'Ajuste de Saldo Inicial (Caja Real)',
                amount: Math.abs(diff),
                category: 'otros',
                paymentMethod: 'efectivo',
                UserId: admin.id,
                date: new Date()
            });
            console.log(`✅ Se ha creado un egreso de ajuste por S/ ${Math.abs(diff).toFixed(2)}`);
        }

        console.log(`🚀 Saldo final ajustado a S/ ${targetBalance.toFixed(2)}`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error realizando el ajuste:', error);
        process.exit(1);
    }
}

adjustCash();
