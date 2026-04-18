const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const dbPath = path.join(__dirname, 'config', 'db.js');
const sequelize = require(dbPath);
const { Product, ProductVariant, Recipe, Ingredient } = require('./models');
const { logAction } = require('./utils/audit'); // Import logAction

async function debugPut() {
    try {
        await sequelize.authenticate();
        console.log("Connected to DB.");

        const id = 45; // Target Tequeños
        const product = await Product.findByPk(id);
        if (!product) {
            console.log(`Product ${id} not found.`);
            return;
        }

        console.log("Product found:", product.name);
        console.log("Current Prep:", product.requiresPreparation);
        console.log("Current Presentations (raw):", product.presentations);

        const t = await sequelize.transaction();
        try {
            // RESET to true first
            await product.update({ requiresPreparation: true }, { transaction: t });

            // Now update with STRING "false"
            const updatePayload = {
                requiresPreparation: "false", // Simulate string payload
                isStockManaged: false,
                presentations: JSON.stringify([])
            };

            await product.update(updatePayload, { transaction: t });



            // Verify persistence
            const updated = await Product.findByPk(id);
            console.log("Post-Update Prep (should be false):", updated.requiresPreparation);
            // Type check
            console.log("Type:", typeof updated.requiresPreparation);

            // Define presentationsList for the subsequent block, based on the updatePayload
            const presentationsList = JSON.parse(updatePayload.presentations);

            if (presentationsList) {
                const existingVariants = await ProductVariant.findAll({ where: { ProductId: id }, transaction: t });
                for (const p of presentationsList) {
                    const variantName = p.name || p.size || String(p.price);
                    let match = p.id ? existingVariants.find(ev => ev.id == p.id) : existingVariants.find(ev => ev.name === variantName);

                    if (match) {
                        await match.update({
                            price: p.price,
                            name: p.name || match.name
                        }, { transaction: t });
                    } else {
                        await ProductVariant.create({
                            ProductId: id,
                            name: variantName,
                            price: p.price,
                            stock: p.stock || 0
                        }, { transaction: t });
                    }
                }
            }

            // Call logAction with mock req
            const mockReq = {
                user: undefined, // Simulate no user
                body: { userId: null },
                ip: '127.0.0.1',
                connection: { remoteAddress: '127.0.0.1' }
            };
            await logAction(mockReq, 'UPDATE_PRODUCT', 'Product', id, { changes: { test: 'data' } });

            await t.commit();
            console.log("Update SUCCESS.");

            // Verify persistence
            const final = await Product.findByPk(id);
            console.log("Final Prep (should be false/0):", final.dataValues.requiresPreparation);
            console.log("Type:", typeof final.dataValues.requiresPreparation);



        } catch (err) {
            await t.rollback();
            console.error("Update FAILED:");
            console.error(err);
        }

    } catch (error) {
        console.error("Setup Error:", error);
    } finally {
        await sequelize.close();
    }
}

debugPut();
