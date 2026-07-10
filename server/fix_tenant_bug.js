const fs = require('fs');
const path = require('path');

async function run() {
    const filePath = path.join(__dirname, 'routes', 'operation.routes.js');
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Update signature
    content = content.replace(
        'const processStockChange = async (productId, quantity, isDeduction, presentation = null, transaction = null, userId = null, accountId = null) => {',
        'const processStockChange = async (productId, quantity, isDeduction, presentation = null, transaction = null, userId = null, accountId = null, tenantId = null) => {'
    );

    // 2. Update calls to pass req.tenant.id (except recursive call)
    content = content.replace(/await processStockChange\((order\.ProductId, order\.quantity, false, order\.presentation, null, order\.UserId, order\.AccountId)\);/g, 'await processStockChange($1, req.tenant.id);');
    content = content.replace(/await processStockChange\((sub\.productId, totalSubQty, false, null, null, order\.UserId, order\.AccountId)\);/g, 'await processStockChange($1, req.tenant.id);');
    content = content.replace(/await processStockChange\((sub\.productId, subQty, true, null, t, userId, accountId)\);/g, 'await processStockChange($1, req.tenant.id);');
    content = content.replace(/await processStockChange\((item\.productId, item\.quantity, true, item\.presentation, t, userId, accountId)\);/g, 'await processStockChange($1, req.tenant.id);');
    content = content.replace(/await processStockChange\((sub\.productId, totalSubQty, true, null, t, userId, accountId)\);/g, 'await processStockChange($1, req.tenant.id);');
    content = content.replace(/await processStockChange\((order\.ProductId, 1, false, order\.presentation, null, order\.UserId, order\.AccountId)\);/g, 'await processStockChange($1, req.tenant.id);');

    // 3. Update recursive call
    content = content.replace(/return processStockChange\(product\.linkedProductId, quantity, isDeduction, presentation, transaction, userId, accountId\);/g, 'return processStockChange(product.linkedProductId, quantity, isDeduction, presentation, transaction, userId, accountId, tenantId);');

    // 4. Update IngredientMovement.create
    content = content.replace(/AccountId: accountId \|\| null\n                    }, { transaction }\);/g, 'AccountId: accountId || null,\n                        TenantId: tenantId\n                    }, { transaction });');

    // 5. Update ProductMovement.create for Recipes
    content = content.replace(/AccountId: accountId \|\| null\n            }, { transaction }\);\n            console\.log\(`\[Stock\] Recorded ProductMovement for recipe item:/g, 'AccountId: accountId || null,\n                TenantId: tenantId\n            }, { transaction });\n            console.log(`[Stock] Recorded ProductMovement for recipe item:');

    // 6. Update ProductMovement.create for Direct Stock
    content = content.replace(/AccountId: accountId \|\| null\n            }, { transaction }\);\n\n            \/\/ REMOVED: DOUBLE STOCK DEDUCTION BUG FIX/g, 'AccountId: accountId || null,\n                TenantId: tenantId\n            }, { transaction });\n\n            // REMOVED: DOUBLE STOCK DEDUCTION BUG FIX');

    // 7. Update ProductMovement.create for Menu
    content = content.replace(/UserId: userId\n            }, { transaction }\);\n            console\.log\(`\[Stock\] Created ProductMovement for Menu/g, 'UserId: userId,\n                TenantId: tenantId\n            }, { transaction });\n            console.log(`[Stock] Created ProductMovement for Menu');

    // 8. Update ProductMovement.create for Libre
    content = content.replace(/AccountId: accountId \|\| null\n            }, { transaction }\);\n            console\.log\(`\[Stock\] Created virtual ProductMovement for Libre/g, 'AccountId: accountId || null,\n                TenantId: tenantId\n            }, { transaction });\n            console.log(`[Stock] Created virtual ProductMovement for Libre');


    fs.writeFileSync(filePath, content);
    console.log("File operation.routes.js patched successfully.");
    
    // Now fix DB
    const { getModels } = require('./models');
    const { sequelize } = getModels();
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
