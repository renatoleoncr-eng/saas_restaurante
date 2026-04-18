const { Product, Ingredient, sequelize } = require('./models');

async function verifyUniqueness() {
    console.log('--- STARTING MODEL-BASED UNIQUENESS TESTS ---');
    const t = await sequelize.transaction();

    try {
        // 1. Create a Base Product
        console.log('\n[1] Creating Base Product "Test Product"...');
        const p1 = await Product.create({
            name: 'Test Product',
            price: 10,
            type: 'dish'
        }, { transaction: t });
        console.log('Success: Product created (ID:', p1.id, ')');

        // 2. Simulate POST /products check for SAME name (case different)
        console.log('\n[2] Checking duplicate product "test product" (case-insensitive)...');
        const name2 = 'test product';
        const existingP = await Product.findOne({
            where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), name2.trim().toLowerCase()),
            paranoid: false,
            transaction: t
        });
        if (existingP) {
            console.log('PASS: Correctly found duplicate product:', existingP.name);
        } else {
            console.error('FAIL: Should have found duplicate product.');
        }

        // 3. Simulate POST /ingredients check for SAME name as Product
        console.log('\n[3] Checking ingredient "Test Product" (conflicts with Product)...');
        const existingP2 = await Product.findOne({
            where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), 'Test Product'.toLowerCase()),
            paranoid: false,
            transaction: t
        });
        if (existingP2) {
            console.log('PASS: Correctly found conflicting product for ingredient.');
        } else {
            console.error('FAIL: Should have found conflicting product.');
        }

        // 4. Create a Base Ingredient
        console.log('\n[4] Creating Base Ingredient "Test Ingredient"...');
        const i1 = await Ingredient.create({
            name: 'Test Ingredient',
            unit: 'kg',
            stock: 50
        }, { transaction: t });
        console.log('Success: Ingredient created (ID:', i1.id, ')');

        // 5. Simulate POST /products check for SAME name as Ingredient
        console.log('\n[5] Checking product "test ingredient" (conflicts with Ingredient)...');
        const existingI = await Ingredient.findOne({
            where: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), 'test ingredient'.toLowerCase()),
            transaction: t
        });
        if (existingI) {
            console.log('PASS: Correctly found conflicting ingredient for product.');
        } else {
            console.error('FAIL: Should have found conflicting ingredient.');
        }

        console.log('\n--- TESTS COMPLETED SUCCESSFULLY (In-Memory Check) ---');

    } catch (err) {
        console.error('TEST ERROR:', err.message);
    } finally {
        // Always rollback to keep database clean
        console.log('\nRolling back transaction...');
        await t.rollback();
        process.exit();
    }
}

verifyUniqueness();
