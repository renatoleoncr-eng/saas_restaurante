const { Product } = require('./models');

async function createMenuProduct() {
    try {
        // Check if menu product already exists
        const existing = await Product.findOne({ where: { type: 'menu', name: 'Menú del Día' } });

        if (existing) {
            console.log(`✓ Menu product already exists: ID ${existing.id} - "${existing.name}"`);
            process.exit(0);
        }

        // Create the menu product
        const menuProduct = await Product.create({
            name: 'Menú del Día',
            type: 'menu',
            price: 14.00, // Default price, will be overridden by menu config
            stock: 0, // Stock is managed by DailyMenu config
            isStockManaged: false, // Menu stock is virtual
            category: 'menu',
            presentations: null
        });

        console.log(`✅ Created menu product successfully!`);
        console.log(`   ID: ${menuProduct.id}`);
        console.log(`   Name: "${menuProduct.name}"`);
        console.log(`   Type: ${menuProduct.type}`);
        console.log(`   Price: S/ ${menuProduct.price}`);
        console.log(`\n⚠️  IMPORTANT: Update TableControl.jsx to use this product ID instead of "menu-group-Menú del Día"`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating menu product:', error);
        process.exit(1);
    }
}

createMenuProduct();
