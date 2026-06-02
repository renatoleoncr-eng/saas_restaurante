const { Product, sequelize } = require('./models');

async function applyPhase1Inventory() {
    try {
        console.log("Conectando a la base de datos...");
        await sequelize.authenticate();
        console.log("Conexión exitosa.");

        // 1. Update DRINKS and OTHER to be count-managed but without recipes
        const [updatedDrinksCount] = await Product.update(
            { isStockManaged: true, requiresPreparation: false },
            { 
                where: { 
                    type: ['drink', 'other'] 
                } 
            }
        );
        console.log(`Bebidas y otros actualizados: ${updatedDrinksCount} productos (Stock físico manual, sin receta)`);

        // 2. Update DISHES and MENU to have infinite stock and no recipes
        const [updatedDishesCount] = await Product.update(
            { isStockManaged: false, requiresPreparation: false },
            { 
                where: { 
                    type: ['dish', 'menu', 'daily_entry', 'daily_main'] 
                } 
            }
        );
        console.log(`Platos y menús actualizados: ${updatedDishesCount} productos (Stock infinito, sin receta)`);

        console.log("¡Fase 1 de inventario configurada correctamente!");
        process.exit(0);
    } catch (error) {
        console.error("Error al actualizar los productos:", error);
        process.exit(1);
    }
}

applyPhase1Inventory();
