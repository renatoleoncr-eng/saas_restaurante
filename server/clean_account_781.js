const { Account, Order, Payment } = require('./models');

async function cleanZombieAccount() {
    try {
        console.log("Buscando cuenta 781...");
        const account = await Account.findByPk(781);
        if (!account) {
            console.log("La cuenta 781 no existe.");
            return;
        }

        console.log("Borrando pedidos asociados a la cuenta 781...");
        const deletedOrders = await Order.destroy({ where: { AccountId: 781 } });
        console.log(`Pedidos borrados: ${deletedOrders}`);

        console.log("Borrando cuenta 781...");
        await account.destroy();
        console.log("Cuenta 781 eliminada correctamente.");

    } catch (e) {
        console.error("Error limpiando cuenta:", e);
    } finally {
        process.exit();
    }
}

cleanZombieAccount();
