const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

const models = [
    'RestaurantConfig', 'Area', 'Table', 'Account', 'Product', 'User', 'Order', 'Payment', 'ProductVariant',
    'Ingredient', 'Recipe', 'SubItem', 'IngredientMovement', 'ProductMovement',
    'CashSession', 'DailyMenu', 'BillingConfig', 'Invoice', 'QrAccount', 'PromotionGroup', 'Promotion', 'Setting'
];

for (const file of files) {
    const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
    
    // We want to find cases like Model.create({ ... })
    // We can just use a simple regex to find `.create({`
    
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('.create({')) {
            // Check next few lines for TenantId
            let foundTenantId = false;
            let block = "";
            for (let j = i; j < Math.min(i + 20, lines.length); j++) {
                block += lines[j] + '\n';
                if (lines[j].includes('TenantId')) {
                    foundTenantId = true;
                    break;
                }
                if (lines[j].includes('})')) {
                    break; // End of create block
                }
            }
            if (!foundTenantId && block.includes('})')) {
                console.log(`Potential missing TenantId in ${file}:${i+1}`);
                console.log(block);
                console.log('---');
            }
        }
    }
}
