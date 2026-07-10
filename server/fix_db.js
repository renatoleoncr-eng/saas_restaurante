const fs = require('fs');
const path = require('path');

async function run() {
    // 9. DB Fixes
    const { sequelize } = require('./models');
    try {
        await sequelize.query(`
            UPDATE ProductMovements pm
            JOIN Products p ON pm.ProductId = p.id
            SET pm.TenantId = p.TenantId
            WHERE pm.TenantId IS NULL;
        `);
        console.log("ProductMovements TenantId fixed.");
        
        await sequelize.query(`
            UPDATE IngredientMovements im
            JOIN Ingredients i ON im.IngredientId = i.id
            SET im.TenantId = i.TenantId
            WHERE im.TenantId IS NULL;
        `);
        console.log("IngredientMovements TenantId fixed.");
    } catch(e) {
        console.error("DB fix error:", e);
    }
}
run();
