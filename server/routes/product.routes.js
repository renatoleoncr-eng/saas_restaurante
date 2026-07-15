const express = require('express');
const router = express.Router();
const { logAction } = require('../utils/audit');

// Local require helper to avoid circular dependencies
const getModels = () => require('../models');

// Get all products (with Variants)
router.get('/products', async (req, res) => {
    console.log(`[DEBUG] /api/products request received from ${req.ip} at ${new Date().toISOString()}`);
    try {
        const { Product, ProductVariant, Recipe, Ingredient } = getModels();
        const products = await Product.findAll({
            where: { TenantId: req.tenant.id },
            include: [
                { model: Recipe, include: [Ingredient] },
                { model: ProductVariant }
            ],
            order: [
                ['name', 'ASC'],
                [ProductVariant, 'sortIndex', 'ASC']
            ]
        });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Product (Handle Variants)
router.post('/products', async (req, res) => {
    console.time('CREATE_PRODUCT_ENDPOINT');
    const { sequelize, Product, ProductVariant, Recipe, Ingredient } = getModels();
    const t = await sequelize.transaction();
    try {
        const { name, price, type, isStockManaged, stock, category, linkedProductId, presentationsList, recipes, requiresPreparation, happyHourPrice, happyHourStart, happyHourEnd } = req.body;

        console.log(`[POST /products] Creating product '${name}'`);
        console.log(`  - requiresPreparation RAW: ${JSON.stringify(requiresPreparation)} (type: ${typeof requiresPreparation})`);
        console.log(`  - isStockManaged: ${isStockManaged}`);

        // Coerce to boolean properly
        const finalRequiresPreparation = requiresPreparation === false || requiresPreparation === 'false' ? false : (requiresPreparation === true || requiresPreparation === 'true' ? true : true);
        console.log(`  - requiresPreparation FINAL: ${finalRequiresPreparation}`);

        // Validate > 0 price for menu options
        if ((type === 'daily_entry' || type === 'daily_main') && (!price || parseFloat(price) <= 0)) {
            await t.rollback();
            return res.status(400).json({ error: `El precio para Entradas/Segundos debe ser mayor a 0.` });
        }

        // Check for duplicates (Case-insensitive, scoped by category and tenant)
        const { Op } = require('sequelize');
        const isMenuOption = type === 'daily_entry' || type === 'daily_main';
        const existingProduct = await Product.findOne({
            where: {
                TenantId: req.tenant.id,
                [Op.and]: [
                    sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), name.trim().toLowerCase()),
                    isMenuOption ? { type } : { 
                        requiresPreparation: finalRequiresPreparation,
                        [Op.or]: [
                            { type: { [Op.notIn]: ['daily_entry', 'daily_main'] } },
                            { type: null }
                        ]
                    }
                ]
            },
            paranoid: true
        });
        if (existingProduct) {
            await t.rollback();
            let section = 'Producto';
            if (type === 'daily_entry') section = 'Entradas';
            else if (type === 'daily_main') section = 'Segundos';
            else section = finalRequiresPreparation ? 'Preparados' : 'Terminados';

            return res.status(400).json({ error: `Ya existe un producto en la sección "${section}" con el nombre "${name}".` });
        }

        console.time('PRODUCT_CREATE_ENDPOINT');
        const product = await Product.create({
            name,
            price,
            type,
            isStockManaged,
            stock: Math.max(0, stock || 0),
            category,
            linkedProductId: linkedProductId || null,
            requiresPreparation: finalRequiresPreparation,
            happyHourPrice: happyHourPrice || null,
            happyHourStart: happyHourStart || null,
            happyHourEnd: happyHourEnd || null,
            presentations: '[]',
            TenantId: req.tenant.id
        }, { transaction: t });
        console.timeEnd('PRODUCT_CREATE_ENDPOINT');

        if (presentationsList && presentationsList.length > 0) {
            const seen = new Set();
            for (const p of presentationsList) {
                const variantName = p.name || p.size || 'Estándar';
                const uniqueKey = variantName.trim().toLowerCase();
                if (seen.has(uniqueKey)) {
                    await t.rollback();
                    return res.status(400).json({ error: `No pueden existir dos variantes con el mismo nombre ("${variantName}"). Deben tener nombres distintos (ej. "${variantName} 30" y "${variantName} 40") para que sus recetas sean independientes.` });
                }
                seen.add(uniqueKey);
            }
            for (let idx = 0; idx < presentationsList.length; idx++) {
                const p = presentationsList[idx];
                await ProductVariant.create({
                    ProductId: product.id,
                    name: p.name || p.size || 'Estándar',
                    price: p.price,
                    stock: Math.max(0, p.stock || 0),
                    happyHourPrice: p.happyHourPrice || null,
                    happyHourStart: p.happyHourStart || null,
                    happyHourEnd: p.happyHourEnd || null,
                    sortIndex: idx,
                    TenantId: req.tenant.id
                }, { transaction: t });
            }
        }

        if (recipes && recipes.length > 0) {
            for (const r of recipes) {
                await Recipe.create({
                    ProductId: product.id,
                    IngredientId: r.IngredientId,
                    quantity: r.quantity,
                    presentation: r.presentation || null,
                    TenantId: req.tenant.id
                }, { transaction: t });
            }
        }

        console.time('LOG_AND_COMMIT_ENDPOINT');
        await t.commit();
        await logAction(req, 'CREATE_PRODUCT', 'Product', product.id, { name, stock });
        console.timeEnd('LOG_AND_COMMIT_ENDPOINT');

        console.time('FETCH_NEW_PRODUCT_ENDPOINT');
        const newProduct = await Product.findByPk(product.id, {
            include: [{ model: ProductVariant }, { model: Recipe, include: [Ingredient] }]
        });
        console.timeEnd('FETCH_NEW_PRODUCT_ENDPOINT');

        res.json(newProduct);
        console.timeEnd('CREATE_PRODUCT_ENDPOINT');
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
        console.timeEnd('CREATE_PRODUCT_ENDPOINT');
    }
});

// Update Product
router.put('/products/:id', async (req, res) => {
    const { sequelize, Product, ProductVariant, Recipe, Ingredient } = getModels();
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        // *** FIX: requiresPreparation was missing from destructuring — this was the bug ***
        const { name, price, type, stock, isStockManaged, category, linkedProductId, presentationsList, recipes, requiresPreparation, happyHourPrice, happyHourStart, happyHourEnd } = req.body;

        const product = await Product.findOne({ where: { id, TenantId: req.tenant.id }, transaction: t });
        if (!product) {
            await t.rollback();
            return res.status(404).json({ error: 'Product not found' });
        }

        let parsedPresentations = presentationsList;
        if (typeof presentationsList === 'string') {
            try {
                parsedPresentations = JSON.parse(presentationsList);
            } catch (e) {
                console.error("Invalid presentationsList JSON:", e);
                parsedPresentations = [];
            }
        }

        console.log(`[PUT /products/${id}] Updating product '${product.name}'`);
        console.log(`  - requiresPreparation RAW: ${JSON.stringify(requiresPreparation)} (type: ${typeof requiresPreparation})`);
        console.log(`  - isStockManaged RAW: ${JSON.stringify(isStockManaged)} (type: ${typeof isStockManaged})`);
        console.log(`  - Current DB values: requiresPreparation=${product.requiresPreparation}, isStockManaged=${product.isStockManaged}`);

        // Coerce to boolean properly (handles string 'false'/'true' from form data)
        const finalRequiresPreparation = requiresPreparation === false || requiresPreparation === 'false' ? false
            : requiresPreparation === true || requiresPreparation === 'true' ? true
                : product.requiresPreparation; // fallback to existing
        console.log(`  - requiresPreparation FINAL: ${finalRequiresPreparation}`);
        console.log(`  - parsedPresentations:`, JSON.stringify(parsedPresentations, null, 2));

        const actualType = type || product.type;
        const actualPrice = price !== undefined ? price : product.price;

        // Validate > 0 price for menu options
        if ((actualType === 'daily_entry' || actualType === 'daily_main') && (!actualPrice || parseFloat(actualPrice) <= 0)) {
            await t.rollback();
            return res.status(400).json({ error: `El precio para Entradas/Segundos debe ser mayor a 0.` });
        }

        // Check for duplicates (excluding self, case-insensitive, scoped by category)
        const isMenuOption = (type || product.type) === 'daily_entry' || (type || product.type) === 'daily_main';
        const typeChanged = type && type !== product.type;
        const prepChanged = finalRequiresPreparation !== product.requiresPreparation;
        const nameChanged = name && name.trim().toLowerCase() !== product.name.trim().toLowerCase();

        if (nameChanged || typeChanged || prepChanged) {
            const { Op } = require('sequelize');
            const trimmedName = name ? name.trim().toLowerCase() : product.name.trim().toLowerCase();
            const finalType = type || product.type;

            const existingProduct = await Product.findOne({
                where: {
                    TenantId: req.tenant.id,
                    [Op.and]: [
                        sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), trimmedName),
                        isMenuOption ? { type: finalType } : { 
                            requiresPreparation: finalRequiresPreparation,
                            [Op.or]: [
                                { type: { [Op.notIn]: ['daily_entry', 'daily_main'] } },
                                { type: null }
                            ]
                        },
                        { id: { [Op.ne]: id } }
                    ]
                },
                transaction: t,
                paranoid: true
            });
            if (existingProduct) {
                await t.rollback();
                let section = 'Producto';
                if (finalType === 'daily_entry') section = 'Entradas';
                else if (finalType === 'daily_main') section = 'Segundos';
                else section = finalRequiresPreparation ? 'Preparados' : 'Terminados';

                return res.status(400).json({ error: `Ya existe otro producto en la sección "${section}" con el nombre "${name || product.name}".` });
            }
        }

        await product.update({
            name,
            price,
            type: actualType,
            stock: stock !== undefined ? Math.max(0, stock) : product.stock,
            isStockManaged: isStockManaged !== undefined ? isStockManaged : product.isStockManaged,
            category,
            linkedProductId: linkedProductId || null,
            requiresPreparation: finalRequiresPreparation,
            happyHourPrice: happyHourPrice !== undefined ? happyHourPrice : product.happyHourPrice,
            happyHourStart: happyHourStart !== undefined ? happyHourStart : product.happyHourStart,
            happyHourEnd: happyHourEnd !== undefined ? happyHourEnd : product.happyHourEnd,
            presentations: '[]' // OBSOLETE: We strictly use the ProductVariants relational table now
        }, { transaction: t });

        if (parsedPresentations && Array.isArray(parsedPresentations)) {
            const seen = new Set();
            for (const p of parsedPresentations) {
                const variantName = p.name || p.size || String(p.price);
                const uniqueKey = variantName.trim().toLowerCase();
                if (seen.has(uniqueKey)) {
                    await t.rollback();
                    return res.status(400).json({ error: `No pueden existir dos variantes con el mismo nombre ("${variantName}"). Deben tener nombres distintos (ej. "${variantName} 30" y "${variantName} 40") para que sus recetas e inventarios sean independientes.` });
                }
                seen.add(uniqueKey);
            }
            const existingVariants = await ProductVariant.findAll({ where: { ProductId: id }, transaction: t });
            
            // Reconcile deletion: Find variants in DB that are no longer in the request payload
            const updatedVariantIds = parsedPresentations.map(p => p.id).filter(id => id);
            const toDelete = existingVariants.filter(ev => !updatedVariantIds.includes(ev.id));
            for (const variant of toDelete) {
                await variant.destroy({ transaction: t });
            }

            for (let idx = 0; idx < parsedPresentations.length; idx++) {
                const p = parsedPresentations[idx];
                const variantName = p.name || p.size || String(p.price);
                let match = p.id ? existingVariants.find(ev => ev.id == p.id) : null;

                if (match) {
                    await match.update({
                        price: p.price,
                        name: p.name || match.name,
                        happyHourPrice: p.happyHourPrice || null,
                        happyHourStart: p.happyHourStart || null,
                        happyHourEnd: p.happyHourEnd || null,
                        sortIndex: idx
                    }, { transaction: t });
                } else {
                    await ProductVariant.create({
                        ProductId: id,
                        name: variantName,
                        price: p.price,
                        stock: Math.max(0, p.stock || 0),
                        happyHourPrice: p.happyHourPrice || null,
                        happyHourStart: p.happyHourStart || null,
                        happyHourEnd: p.happyHourEnd || null,
                        sortIndex: idx,
                        TenantId: req.tenant.id
                    }, { transaction: t });
                }
            }
        }

        if (recipes) {
            await Recipe.destroy({ where: { ProductId: id, TenantId: req.tenant.id }, transaction: t });
            for (const r of recipes) {
                await Recipe.create({
                    ProductId: id,
                    IngredientId: r.IngredientId,
                    quantity: r.quantity,
                    presentation: r.presentation || null,
                    TenantId: req.tenant.id
                }, { transaction: t });
            }
        }

        await t.commit();
        await logAction(req, 'UPDATE_PRODUCT', 'Product', id, { userId: req.body.userId || null, name: req.body.name });

        const updatedProduct = await Product.findByPk(id, {
            include: [{ model: ProductVariant }, { model: Recipe, include: [Ingredient] }]
        });
        res.json(updatedProduct);
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
});

// Delete Product
router.delete('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[DEBUG] Attempting to delete product ID: ${id}`);

        const models = getModels();
        const { Product, ProductVariant, Recipe, Order, Account } = models;

        if (!Order) {
            console.error("[DEBUG] Order model is UNDEFINED in product.routes.js");
            return res.status(500).json({ error: 'Internal Server Error: Order model missing' });
        }

        // Only block deletion if the product is in an ACTIVE (OPEN) account.
        const activeSalesCount = await Order.count({
            where: { ProductId: id, TenantId: req.tenant.id },
            include: [{
                model: Account,
                where: { status: 'open', TenantId: req.tenant.id }
            }]
        });
        console.log(`[DEBUG] Product ID ${id} has ${activeSalesCount} orders in ACTIVE accounts`);

        if (activeSalesCount > 0) {
            return res.status(400).json({ error: 'No se puede eliminar el producto porque tiene ventas en mesas ABIERTAS. Cierre las mesas primero.' });
        }

        await Recipe.destroy({ where: { ProductId: id, TenantId: req.tenant.id } });
        await ProductVariant.destroy({ where: { ProductId: id, TenantId: req.tenant.id } });

        const deletedCount = await Product.destroy({ where: { id, TenantId: req.tenant.id } });
        console.log(`[DEBUG] Product ID ${id} deleted count: ${deletedCount}`);

        await logAction(req, 'DELETE_PRODUCT', 'Product', id, null);
        res.json({ success: true });
    } catch (err) {
        console.error("[DEBUG] Delete Error in product.routes.js:", err);
        res.status(500).json({ error: err.message });
    }
});

// === PRODUCT MOVEMENTS (Terminados) ===

// Add/Remove Stock (Manual Movement) - Supports Variants
router.post('/products/:id/movement', async (req, res) => {
    const { sequelize, Product, ProductVariant, ProductMovement } = getModels();
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { type, amount, reason, userId, variantId } = req.body;

        let previousStock = 0;
        let newStock = 0;
        let variantName = null;

        if (variantId) {
            const variant = await ProductVariant.findOne({ where: { id: variantId, ProductId: id, TenantId: req.tenant.id }, transaction: t });
            if (!variant) throw new Error("Variante no encontrada");

            previousStock = parseFloat(variant.stock);
            if (type === 'add') newStock = previousStock + parseFloat(amount);
            else if (type === 'remove') newStock = Math.max(0, previousStock - parseFloat(amount));
            else newStock = Math.max(0, parseFloat(amount));

            variant.stock = newStock;
            await variant.save({ transaction: t });
            variantName = variant.name;

        } else {
            const product = await Product.findOne({ where: { id, TenantId: req.tenant.id }, transaction: t });
            if (!product) {
                await t.rollback();
                return res.status(404).json({ error: 'Producto no encontrado' });
            }

            previousStock = parseFloat(product.stock);
            if (type === 'add') newStock = previousStock + parseFloat(amount);
            else if (type === 'remove') newStock = Math.max(0, previousStock - parseFloat(amount));
            else newStock = Math.max(0, parseFloat(amount));

            product.stock = newStock;
            await product.save({ transaction: t });
        }

        await ProductMovement.create({
            ProductId: id,
            ProductVariantId: variantId || null,
            type: type,
            amount: parseFloat(amount),
            reason: reason + (variantName ? ` [${variantName}]` : ''),
            previousStock: previousStock,
            newStock: newStock,
            UserId: userId || null,
            TenantId: req.tenant.id
        }, { transaction: t });

        await t.commit();
        res.json({ success: true, newStock });
    } catch (err) {
        await t.rollback();
        res.status(500).json({ error: err.message });
    }
});

// Get Movements for a Product
router.get('/products/:id/movements', async (req, res) => {
    try {
        const { id } = req.params;
        const { ProductMovement, ProductVariant, User } = getModels();
        const movements = await ProductMovement.findAll({
            where: { ProductId: id, TenantId: req.tenant.id },
            include: [{ model: User, attributes: ['displayName', 'username'] }, { model: ProductVariant }],
            order: [['createdAt', 'DESC']]
        });
        res.json(movements);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get All Movements (Global History) with Filters
router.get('/products/movements/all', async (req, res) => {
    try {
        const { ProductMovement, Product, User } = getModels();
        const { type, isStockManaged, requiresPreparation, excludeMenu } = req.query;

        const productWhere = {};
        if (type) {
            const types = type.split(',');
            productWhere.type = types;
        }
        if (isStockManaged !== undefined) {
            productWhere.isStockManaged = isStockManaged === 'true';
        }
        if (requiresPreparation !== undefined) {
            productWhere.requiresPreparation = requiresPreparation === 'true';
        }
        if (excludeMenu === 'true') {
            const { Op } = require('sequelize');
            productWhere.type = { [Op.notIn]: ['daily_entry', 'daily_main', 'daily_option', 'menu'] };
        }

        const movements = await ProductMovement.findAll({
            where: { TenantId: req.tenant.id },
            include: [
                {
                    model: Product,
                    attributes: ['name', 'type', 'isStockManaged', 'requiresPreparation'],
                    where: Object.keys(productWhere).length > 0 ? { ...productWhere, TenantId: req.tenant.id } : { TenantId: req.tenant.id },
                    paranoid: false
                },
                { model: User, attributes: ['username', 'displayName'] },
                { model: getModels().Account, attributes: ['id', 'accountType'], required: false }
            ],
            order: [['createdAt', 'DESC']],
            limit: 1000
        });
        res.json(movements);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
