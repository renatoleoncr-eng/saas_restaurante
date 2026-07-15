const { getModels } = require('./models');
const { Op } = require('sequelize');
const sequelize = require('./config/database'); // or wherever it is

async function test() {
    const { Ingredient } = getModels();
    try {
        const id = 1;
        const tenantId = 1;
        const name = 'Chicharron de pollo test';
        const trimmedName = name.trim().toLowerCase();
        
        const existingIngredient = await Ingredient.findOne({
            where: id ? {
                TenantId: tenantId,
                [Op.and]: [
                    sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), trimmedName),
                    { id: { [Op.ne]: id } }
                ]
            } : {
                TenantId: tenantId,
                [Op.and]: [sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), trimmedName)]
            }
        });
        console.log("existing:", existingIngredient);
    } catch (e) {
        console.error("ERROR:", e);
    }
    process.exit(0);
}

test();
