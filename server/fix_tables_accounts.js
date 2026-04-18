const { Account, Table } = require('./models');

(async () => {
    try {
        console.log("Revinculando Cuentas a Mesas 3 y 4...");

        // Mesa 3 -> Cuenta 13
        const acc13 = await Account.findByPk(13);
        if (acc13) {
            await acc13.update({ TableId: 3 });
            await Table.update({ status: 'occupied' }, { where: { id: 3 } });
            console.log("Cuenta 13 -> Mesa 3 vinculada.");
        }

        // Mesa 4 -> Cuenta 14
        const acc14 = await Account.findByPk(14);
        if (acc14) {
            await acc14.update({ TableId: 4 });
            await Table.update({ status: 'occupied' }, { where: { id: 4 } });
            console.log("Cuenta 14 -> Mesa 4 vinculada.");
        }

    } catch (err) {
        console.error("Error en restauración:", err);
    } process.exit(0);
})();
