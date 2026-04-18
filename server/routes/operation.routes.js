const express = require('express');
const router = express.Router();
// Local require helper to avoid circular dependencies
const getModels = () => require('../models');
const { getHotelDayRange } = require('../utils/dateUtils');

// --- ACCOUNTS ---

// Open a new Account for a Table
router.post('/accounts/open', async (req, res) => {
    try {
        const { Account, Table } = getModels();
        const { tableId, customerName, clientDni, userId, accountType } = req.body;

        // Check if table is occupied
        const table = await Table.findByPk(tableId);
        if (table.status === 'occupied') {
            return res.status(400).json({ error: 'Mesa ya ocupada' });
        }

        const account = await Account.create({
            TableId: tableId,
            customerName: customerName || (accountType === 'staff' ? 'Personal' : 'Cliente'),
            clientDni: clientDni || null,
            status: 'open',
            accountType: accountType || 'standard'
        });

        // Update Table Status
        table.status = 'occupied';
        await table.save();

        const io = req.app.get('io');
        if (io) {
            io.emit('table_updated', { tableId: table.id, status: 'occupied' });
        }

        res.json(account);
    } catch (err) {
        console.error("ERROR CREATING ACCOUNT:", err);
        res.status(500).json({ error: err.message });
    }
});

// Update Account Info (Name / DNI)
router.put('/accounts/:id', async (req, res) => {
    try {
        const { Account } = getModels();
        const { customerName, clientDni, accountType } = req.body;
        const account = await Account.findByPk(req.params.id);

        if (!account) return res.status(404).json({ error: 'Cuenta no encontrada' });

        if (customerName !== undefined) account.customerName = customerName;
        if (clientDni !== undefined) account.clientDni = clientDni;
        if (accountType !== undefined && accountType !== account.accountType) {
            account.accountType = accountType;
            // If converting to staff, force all orders to 0 and reset total
            if (accountType === 'staff') {
                const { Order } = getModels();
                await Order.update({ priceAtOrder: 0 }, { where: { AccountId: account.id } });
                account.total = 0;
            }
        }

        await account.save();
        res.json(account);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Transfer Account to another Table
router.post('/accounts/transfer', async (req, res) => {
    const t = await getModels().sequelize.transaction();
    try {
        const { Account, Table } = getModels();
        const { currentTableId, newTableId } = req.body;

        // 1. Validate Target Table is Free
        const newTable = await Table.findByPk(newTableId, { transaction: t });
        if (!newTable) {
            await t.rollback();
            return res.status(404).json({ error: 'Mesa de destino no encontrada' });
        }
        if (newTable.status !== 'free') {
            await t.rollback();
            return res.status(400).json({ error: 'La mesa de destino ya está ocupada' });
        }

        // 2. Find Active Account on Current Table
        const account = await Account.findOne({
            where: { TableId: currentTableId, status: 'open' },
            transaction: t
        });

        if (!account) {
            await t.rollback();
            return res.status(404).json({ error: 'No hay cuenta activa en la mesa actual' });
        }

        // 3. Update Account TableId
        account.TableId = newTableId;
        await account.save({ transaction: t });

        // 4. Update Tables Status
        // Occupy new table
        newTable.status = 'occupied';
        await newTable.save({ transaction: t });

        // Free old table
        const oldTable = await Table.findByPk(currentTableId, { transaction: t });
        oldTable.status = 'free';
        await oldTable.save({ transaction: t });

        await t.commit();

        // 5. Notify Frontend
        const io = req.app.get('io');
        io.emit('table_updated', {});

        res.json({ success: true, message: 'Mesa cambiada con éxito', account });
    } catch (err) {
        await t.rollback();
        console.error("ERROR TRANSFERRING TABLE:", err);
        res.status(500).json({ error: err.message });
    }
});

// Get Active Account for a Table
router.get('/accounts/table/:tableId', async (req, res) => {
    try {
        const { Account, Order, Product } = getModels();
        const { tableId } = req.params;
        const account = await Account.findOne({
            where: { TableId: tableId, status: 'open' },
            include: [{ model: Order, include: [Product] }]
        });
        res.json(account);
    } catch (err) {
        console.error("ERROR GETTING ACCOUNT BY TABLE:", err);
        res.status(500).json({ error: err.message });
    }
});

// Configure Multer for Evidence Uploads
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Create an account-specific folder based on the ID if available, otherwise root
        const accountId = req.params.id || 'general';
        const accountDir = path.join(uploadDir, `account_${accountId}`);
        if (!fs.existsSync(accountDir)) {
            fs.mkdirSync(accountDir, { recursive: true });
        }
        cb(null, accountDir);
    },
    filename: function (req, file, cb) {
        cb(null, 'evidence-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Helper to restore stock for an order
const restoreOrderStock = async (order) => {
    try {
        // Models are used in sub-functions, but logic here calls them.
        console.log(`[Stock] restoreOrderStock called for Order ${order.id} | Product: ${order.ProductId} | Qty: ${order.quantity} | Pres: ${order.presentation}`);
        // 1. Restore Stock for Main Product
        await processStockChange(order.ProductId, order.quantity, false, order.presentation, null, order.UserId, order.AccountId);

        // 2. Restore Stock for SubItems
        if (order.subItemsData) {
            const subItems = typeof order.subItemsData === 'string' ? JSON.parse(order.subItemsData) : order.subItemsData;
            if (Array.isArray(subItems)) {
                for (const sub of subItems) {
                    const totalSubQty = (sub.quantity || 1) * order.quantity;

                    // A. Restore Menu Config Stock (Virtual Limit)
                    if (sub.menuItemId) {
                        await updateDailyMenuStock(sub.menuItemId, totalSubQty, false);
                        console.log(`[Stock] Restored DailyMenu stock for item ${sub.menuItemId} by ${totalSubQty}`);
                    }

                    // B. Restore Physical Inventory (if linked)
                    if (sub.productId) {
                        await processStockChange(sub.productId, totalSubQty, false, null, null, order.UserId, order.AccountId);
                        console.log(`[Stock] Restored physical stock for sub-product ${sub.productId} by ${totalSubQty}`);
                    }
                }
            }
        }
    } catch (e) {
        console.error(`[Stock] Error restoring stock for order ${order.id}:`, e);
    }
};

// Close Account (Modified for Multipart/Upload of multiple files)
router.post('/accounts/:id/close', upload.array('evidence', 10), async (req, res) => {
    try {
        const { Account, Table, Payment } = getModels();
        const { id } = req.params;
        const { paymentMethod } = req.body;

        const account = await Account.findByPk(id);
        if (!account) return res.status(404).json({ error: 'Cuenta no encontrada' });

        if (paymentMethod) {
            account.paymentMethod = paymentMethod;
        }

        if (req.files && req.files.length > 0) {
            const filePaths = req.files.map(file => `/uploads/account_${id}/${file.filename}`);
            account.paymentEvidence = JSON.stringify(filePaths);
        } else if (req.file) {
            // Keep backwards compatibility for old single upload just in case
            account.paymentEvidence = JSON.stringify([`/uploads/account_${id}/${req.file.filename}`]);
        }

        // Calculate missing amount and generate payment
        const allPayments = await Payment.findAll({ where: { AccountId: account.id } });
        const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        const remaining = Math.max(0, Number(account.total) - totalPaid);

        if (remaining > 0 && paymentMethod !== 'consumo_interno') {
            await Payment.create({
                AccountId: account.id,
                amount: remaining,
                method: paymentMethod || 'efectivo',
                evidence: account.paymentEvidence,
                UserId: req.body.userId || null
            });
        }

        account.status = 'closed';
        account.closedAt = new Date();
        await account.save();

        // Free the table
        const table = await Table.findByPk(account.TableId);
        table.status = 'free';
        await table.save();

        const io = req.app.get('io');
        if (io) {
            io.emit('table_updated', { tableId: table.id, status: 'free' });
        }

        res.json(account);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Partial Payment (Abono a Cuenta)
router.post('/accounts/:id/pay', upload.array('evidence', 10), async (req, res) => {
    try {
        const { Account, Table, Payment } = getModels();
        const { id } = req.params;
        const { amount, paymentMethod, userId } = req.body;

        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Monto inválido' });
        }

        const account = await Account.findByPk(id, { include: [Payment] });
        if (!account) return res.status(404).json({ error: 'Cuenta no encontrada' });
        if (account.status !== 'open') return res.status(400).json({ error: 'La cuenta no está abierta' });

        let evidencePath = null;
        if (req.files && req.files.length > 0) {
            const filePaths = req.files.map(file => `/uploads/account_${id}/${file.filename}`);
            evidencePath = JSON.stringify(filePaths);
        } else if (req.file) {
            evidencePath = JSON.stringify([`/uploads/account_${id}/${req.file.filename}`]);
        }

        // Create the Partial Payment record
        const payment = await Payment.create({
            AccountId: account.id,
            amount: parseFloat(amount),
            method: paymentMethod || 'efectivo',
            evidence: evidencePath,
            UserId: userId || null
        });

        // Re-calculate total paid
        const allPayments = await Payment.findAll({ where: { AccountId: account.id } });
        const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);

        // Auto-close if fully paid
        if (totalPaid >= Number(account.total)) {
            account.status = 'closed';
            account.closedAt = new Date();
            // Store the last payment method on the account as primary reference. 
            // Or leave it since the details are in the Payments table now.
            if (paymentMethod) account.paymentMethod = paymentMethod;
            if (evidencePath && !account.paymentEvidence) account.paymentEvidence = evidencePath; // fallback

            await account.save();

            const table = await Table.findByPk(account.TableId);
            if (table) {
                table.status = 'free';
                await table.save();
            }

            const io = req.app.get('io');
            if (io) {
                io.emit('table_updated', { tableId: table.id, status: 'free' });
            }
        }

        res.json({ success: true, payment, totalPaid, accountRawTotal: account.total, isClosed: account.status === 'closed' });

    } catch (err) {
        console.error("Error saving partial payment:", err);
        res.status(500).json({ error: err.message });
    }
});

// Cancel Account (Liberar Mesa w/o payment)
router.post('/accounts/:id/cancel', async (req, res) => {
    try {
        const { Account, Order, Table } = getModels();
        const { id } = req.params;
        const account = await Account.findByPk(id, {
            include: [Order]
        });

        if (!account) return res.status(404).json({ error: 'Cuenta no encontrada' });

        // Restore stock for ALL orders in this account before cancelling
        if (account.Orders && account.Orders.length > 0) {
            console.log(`[Cancel] Restoring stock for ${account.Orders.length} orders in Account ${id}`);
            for (const order of account.Orders) {
                if (order.status !== 'cancelled') {
                    await restoreOrderStock(order);
                    order.status = 'cancelled';
                    await order.save();
                }
            }
        }

        account.status = 'cancelled';
        account.closedAt = new Date();
        await account.save();

        const table = await Table.findByPk(account.TableId);
        if (table) {
            table.status = 'free';
            await table.save();
        }

        // Notify Clients of Update (Stock Restored + Table Free)
        const io = req.app.get('io');
        if (io) {
            io.emit('new_order', { accountId: id, tableId: account.TableId, type: 'cancel' });
            io.emit('table_updated', { tableId: account.TableId, status: 'free' });
        }

        res.json({ success: true, account });
    } catch (err) {
        console.error("ERROR CANCELLING ACCOUNT:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- ORDERS ---

// Helper to update DailyMenu stock (Limit) - ID-BASED
// Helper to update DailyMenu stock (Limit) - ID-BASED
const updateDailyMenuStock = async (menuItemId, quantity, isDeduction, transaction = null) => {
    try {
        const { DailyMenu } = getModels();
        if (!menuItemId) return; // Skip if no menu item ID provided

        // Fix: Use local date (Peru GMT-5) or allow tolerance
        // Ideally we get the "Working Date" from a config, but for now shift UTC-5
        const now = new Date();
        now.setHours(now.getHours() - 5);
        const today = now.toISOString().split('T')[0];

        // Find menu for today using the same transaction to see uncommitted changes
        const menu = await DailyMenu.findOne({ where: { date: today }, transaction });
        if (!menu) {
            console.log(`[MenuStock] No menu found for ${today}`);
            return;
        }

        let entries = JSON.parse(menu.entries || '[]');
        let mains = JSON.parse(menu.mains || '[]');
        let updated = false;

        // Helper to update list by ID
        const updateList = (list) => {
            const item = list.find(i => i.id === menuItemId);
            if (item) {
                let currentStock = parseInt(item.stock || 0);
                if (isDeduction) {
                    currentStock = Math.max(0, currentStock - quantity);
                } else {
                    currentStock += quantity;
                }
                item.stock = currentStock.toString();
                updated = true;
                console.log(`[MenuStock] Updated ${item.name} (ID: ${menuItemId}): ${isDeduction ? '-' : '+'}${quantity} -> ${currentStock}`);
            }
        };

        updateList(entries);
        updateList(mains);

        if (updated) {
            menu.entries = JSON.stringify(entries);
            menu.mains = JSON.stringify(mains);
            await menu.save({ transaction });
        } else {
            console.log(`[MenuStock] Item with ID ${menuItemId} not found in today's menu`);
        }
    } catch (e) {
        console.error("Error updating DailyMenu stock:", e);
    }
};

// Helper function to check stock availability before processing an order
const checkStockAvailability = async (orderItems) => {
    const { Product, Recipe, Ingredient, ProductVariant, DailyMenu } = getModels();
    const errors = [];
    const ingredientReqs = {}; // { id: { name, unit, qty } }
    const productReqs = {};    // { id: { name, qty } }
    const variantReqs = {};    // { id: { name, qty } }
    const menuLimitReqs = {};  // { id: { name, qty } }

    try {
        for (const item of orderItems) {
            if (!item.productId) {
                console.log("[StockCheck] Item has no productId (likely combo), skipping main product validation");
            } else {
                const product = await Product.findByPk(item.productId, {
                    include: [{ model: Recipe, include: [Ingredient] }, { model: ProductVariant }]
                });

                if (product) {
                    // VALIDATION: Prevent ordering prepared products that have no recipe configured
                    if (product.requiresPreparation && !product.isStockManaged && product.type !== 'menu' && (!product.Recipes || product.Recipes.length === 0)) {
                        errors.push(`El producto "${product.name}" requiere preparación pero no tiene una receta configurada. Por favor, configure la receta en el panel de administración.`);
                        continue;
                    }
                }
            }

            const qty = item.quantity;

            // 1. Handle Menu Limits (if it's a Daily Menu subitem)
            if (item.subItems && Array.isArray(item.subItems)) {
                for (const sub of item.subItems) {
                    if (sub.menuItemId) {
                        const totalSubQty = (sub.quantity || 1) * qty;
                        if (!menuLimitReqs[sub.menuItemId]) {
                            menuLimitReqs[sub.menuItemId] = { name: sub.name, qty: 0 };
                        }
                        menuLimitReqs[sub.menuItemId].qty += totalSubQty;
                    }
                    if (sub.productId) {
                        // Recursive check for subitems if they have recipes or stock
                        const totalSubQty = (sub.quantity || 1) * qty;
                        await accumulateRequirements(sub.productId, totalSubQty, null, ingredientReqs, productReqs, variantReqs);
                    }
                }
            }

            // 2. Handle Main Product
            if (item.productId) {
                await accumulateRequirements(item.productId, qty, item.presentation, ingredientReqs, productReqs, variantReqs);
            }
        }

        // --- VALIDATE ACCUMULATED REQUIREMENTS ---

        // A. Validate Ingredients
        for (const id in ingredientReqs) {
            const ing = await Ingredient.findByPk(id);
            console.log(`[StockCheck] Validating Ingredient ${id} (${ing?.name}): Req ${ingredientReqs[id].qty}, Avail ${ing?.stock}`);
            if (!ing || parseFloat(ing.stock) < ingredientReqs[id].qty) {
                errors.push(`Insumo insuficiente: ${ingredientReqs[id].name} (Req: ${ingredientReqs[id].qty}${ing?.unit || ''}, Disp: ${ing?.stock || 0}${ing?.unit || ''})`);
            }
        }

        // B. Validate Direct Products
        for (const id in productReqs) {
            const prod = await Product.findByPk(id);
            if (!prod || parseInt(prod.stock) < productReqs[id].qty) {
                errors.push(`Stock insuficiente: ${productReqs[id].name} (Req: ${productReqs[id].qty}, Disp: ${prod?.stock || 0})`);
            }
        }

        // C. Validate Variants
        for (const id in variantReqs) {
            const variant = await ProductVariant.findByPk(id);
            if (!variant || parseInt(variant.stock) < variantReqs[id].qty) {
                errors.push(`Stock insuficiente: ${variantReqs[id].name} (Req: ${variantReqs[id].qty}, Disp: ${variant?.stock || 0})`);
            }
        }

        // D. Validate Menu Limits (DailyMenu)
        if (Object.keys(menuLimitReqs).length > 0) {
            const now = new Date();
            now.setHours(now.getHours() - 5);
            const today = now.toISOString().split('T')[0];
            const menu = await DailyMenu.findOne({ where: { date: today } });

            if (menu) {
                const entries = JSON.parse(menu.entries || '[]');
                const mains = JSON.parse(menu.mains || '[]');
                const allMenuItems = [...entries, ...mains];

                for (const id in menuLimitReqs) {
                    const item = allMenuItems.find(i => i.id === id);
                    console.log(`[StockCheck] Validating Menu Limit ${id} (${menuLimitReqs[id].name}): Req ${menuLimitReqs[id].qty}, Avail ${item?.stock}`);
                    if (!item || parseInt(item.stock || 0) < menuLimitReqs[id].qty) {
                        errors.push(`Límite de menú agotado: ${menuLimitReqs[id].name} (Req: ${menuLimitReqs[id].qty}, Disp: ${item?.stock || 0})`);
                    }
                }
            }
        }

        return {
            ok: errors.length === 0,
            errors
        };

    } catch (err) {
        console.error("[StockCheck] Error:", err);
        return { ok: false, errors: [`Error interno al validar stock: ${err.message}`] };
    }
};

// Helper to accumulate requirements for a product/variant/ingredients
const accumulateRequirements = async (productId, quantity, presentation, ingredientReqs, productReqs, variantReqs) => {
    if (!productId) {
        console.warn("[StockCheck] accumulateRequirements called with null productId. Skipping.");
        return;
    }
    const { Product, Recipe, Ingredient, ProductVariant } = getModels();
    const product = await Product.findByPk(productId, {
        include: [{ model: Recipe, include: [Ingredient] }]
    });

    if (!product) {
        console.warn(`[StockCheck] Product ID ${productId} not found in accumulateRequirements.`);
        return;
    }

    // NEW: Check linkedProductId for menu items
    if ((product.type === 'daily_entry' || product.type === 'daily_main') && product.linkedProductId) {
        return accumulateRequirements(product.linkedProductId, quantity, presentation, ingredientReqs, productReqs, variantReqs);
    }

    if (product.Recipes && product.Recipes.length > 0) {
        // Resolve target recipes based on presentation (copied from processStockChange logic)
        let targetRecipes = [];
        if (presentation) {
            targetRecipes = product.Recipes.filter(r => r.presentation === presentation);
            if (targetRecipes.length === 0) targetRecipes = product.Recipes.filter(r => r.presentation === null);
        } else {
            targetRecipes = product.Recipes.filter(r => r.presentation === null);
            if (targetRecipes.length === 0 && product.Recipes.length > 0) {
                const availablePresentations = [...new Set(product.Recipes.map(r => r.presentation).filter(p => p))];
                if (availablePresentations.length === 1) {
                    targetRecipes = product.Recipes.filter(r => r.presentation === availablePresentations[0]);
                } else {
                    const fallbackPres = availablePresentations.find(p => ['Personal', 'Individual', 'Standard', 'Normal'].includes(p));
                    if (fallbackPres) targetRecipes = product.Recipes.filter(r => r.presentation === fallbackPres);
                }
            }
        }

        for (const recipe of targetRecipes) {
            if (recipe.Ingredient) {
                const amount = parseFloat(recipe.quantity) * quantity;
                const id = recipe.Ingredient.id;
                if (!ingredientReqs[id]) {
                    ingredientReqs[id] = { name: recipe.Ingredient.name, unit: recipe.Ingredient.unit, qty: 0 };
                }
                ingredientReqs[id].qty += amount;
            }
        }
    } else if (product.isStockManaged) {
        if (presentation) {
            const variant = await ProductVariant.findOne({ where: { ProductId: productId, name: presentation } });
            if (variant) {
                if (!variantReqs[variant.id]) {
                    variantReqs[variant.id] = { name: `${product.name} [${variant.name}]`, qty: 0 };
                }
                variantReqs[variant.id].qty += quantity;
            } else {
                if (!productReqs[productId]) {
                    productReqs[productId] = { name: product.name, qty: 0 };
                }
                productReqs[productId].qty += quantity;
            }
        } else {
            if (!productReqs[productId]) {
                productReqs[productId] = { name: product.name, qty: 0 };
            }
            productReqs[productId].qty += quantity;
        }
    }
};

// Helper function to process stock change
const processStockChange = async (productId, quantity, isDeduction, presentation = null, transaction = null, userId = null, accountId = null) => {
    try {
        const { Product, Recipe, Ingredient, ProductVariant, IngredientMovement, ProductMovement } = getModels();

        // 1. Update Daily Menu Stock (Limit) if applicable
        await updateDailyMenuStock(productId, quantity, isDeduction, transaction);

        console.log(`[Stock] Processing ${productId} Qty:${quantity} Ded:${isDeduction} Pres:${presentation}`);
        const product = await Product.findByPk(productId, {
            include: [{ model: Recipe, include: [Ingredient] }],
            transaction
        });
        if (!product) {
            console.log(`[Stock] Product ${productId} not found.`);
            return;
        }

        // NEW: Check linkedProductId for menu items
        if ((product.type === 'daily_entry' || product.type === 'daily_main') && product.linkedProductId) {
            console.log(`[Stock] Product ${productId} is linked to ${product.linkedProductId}. Redirecting stock movement.`);
            // Deduct from the linked product
            return processStockChange(product.linkedProductId, quantity, isDeduction, presentation, transaction, userId, accountId);
        }

        if (product.Recipes && product.Recipes.length > 0) {
            console.log(`[Stock] Product ${product.name} has recipes.`);
            // Filter Recipes based on Presentation
            let targetRecipes = [];

            if (presentation) {
                // 1. Try to find recipes for this specific presentation
                targetRecipes = product.Recipes.filter(r => r.presentation === presentation);

                // 2. Fallback to base
                if (targetRecipes.length === 0) {
                    targetRecipes = product.Recipes.filter(r => r.presentation === null);
                }
            } else {
                // No presentation specified (e.g. Menu SubItem)
                // 1. Try Base Recipe first
                targetRecipes = product.Recipes.filter(r => r.presentation === null);

                // 2. Fallback: If no base recipe, but other presentations exist
                if (targetRecipes.length === 0 && product.Recipes.length > 0) {
                    // Get list of available presentations
                    const availablePresentations = [...new Set(product.Recipes.map(r => r.presentation).filter(p => p))];

                    if (availablePresentations.length === 1) {
                        // Case A: Only one presentation exists (e.g. 'Personal'), use it
                        console.log(`[Stock] Warning: No base recipe for ${product.name}. Using unique presentation: ${availablePresentations[0]}`);
                        targetRecipes = product.Recipes.filter(r => r.presentation === availablePresentations[0]);
                    } else {
                        // Case B: Multiple exist. Try 'Personal' or 'Standard'
                        const fallbackPres = availablePresentations.find(p => ['Personal', 'Individual', 'Standard', 'Normal'].includes(p));
                        if (fallbackPres) {
                            console.log(`[Stock] Warning: No base recipe for ${product.name}. Using fallback presentation: ${fallbackPres}`);
                            targetRecipes = product.Recipes.filter(r => r.presentation === fallbackPres);
                        } else {
                            console.log(`[Stock] Warning: No base recipe for ${product.name} and ambiguous presentations (${availablePresentations.join(',')}). Skipping.`);
                        }
                    }
                }
            }

            // Handle Ingredients
            // const { IngredientMovement, ProductMovement } = require('../models'); // Already got from getModels
            console.log(`[Stock] Checkpoint: Found ${targetRecipes.length} recipes for ${product.name}`);

            for (const recipe of targetRecipes) {
                if (recipe.Ingredient) {
                    const amount = parseFloat(recipe.quantity) * quantity;

                    // ATOMIC UPDATE FOR INGREDIENT
                    if (isDeduction) {
                        await recipe.Ingredient.decrement('stock', { by: amount, transaction });
                    } else {
                        await recipe.Ingredient.increment('stock', { by: amount, transaction });
                    }

                    // Refresh to get new value for logging
                    await recipe.Ingredient.reload({ transaction });
                    const newStock = parseFloat(recipe.Ingredient.stock);
                    const previousStock = isDeduction ? newStock + amount : newStock - amount;

                    console.log(`[Stock] Updating Ingredient ${recipe.Ingredient.name}: ${previousStock} -> ${newStock} (${isDeduction ? '-' : '+'}${amount})`);

                    let ingredientReason = isDeduction ? `Venta: ${product.name} x${quantity}` : `Restauración: ${product.name} x${quantity}`;
                    // Special case for Staff
                    if (isDeduction) {
                        const { Account } = getModels();
                        if (accountId) {
                            const acc = await Account.findByPk(accountId);
                            if (acc && acc.accountType === 'staff') {
                                ingredientReason = `Consumo Personal: ${product.name} x${quantity}`;
                            }
                        }
                    }

                    await IngredientMovement.create({
                        IngredientId: recipe.Ingredient.id,
                        type: isDeduction ? 'sale' : 'add',
                        amount: amount,
                        reason: ingredientReason,
                        previousStock: previousStock,
                        newStock: newStock,
                        UserId: userId, // System action or specific user
                        AccountId: accountId || null
                    }, { transaction });
                } else {
                    console.log(`[Stock] Warning: Recipe matched but has no Ingredient linked? ID: ${recipe.id}`);
                }
            }

            // RECORD FINISHED PRODUCT MOVEMENT (Virtual Stock)
            // Even if we track ingredients, we want to know that "1 Hamburguesa" was sold.
            // We use standard 'stock' field of Product for reference or just 0 if not managed.
            // But ProductMovement requires previousStock/newStock. 
            // If isStockManaged is false, we can just log 0 -> 0 or current -> current.

            const currentStock = Number(product.stock || 0);

            // Note: We are NOT changing product.stock here because it's recipe based (infinite/virtual), 
            // UNLESS mixed mode is active? 
            // If mixed mode (Recipes + isStockManaged=true), we should have hit the other branch?
            // Actually, the current logic is: if (Recipes) { ... } else if (isStockManaged) { ... }
            // So if it has recipes, we are HERE.

            // We still record the movement of the "Title" product.
            let virtualReason = isDeduction ? `Venta: ${product.name} x${quantity}` : `Restauración: ${product.name} x${quantity}`;
            if (isDeduction && accountId) {
                const { Account } = getModels();
                const acc = await Account.findByPk(accountId);
                if (acc && acc.accountType === 'staff') {
                    virtualReason = `Consumo Personal: ${product.name} x${quantity}`;
                }
            }

            await ProductMovement.create({
                ProductId: productId,
                ProductVariantId: null, // Could try to infer from presentation if needed, but usually null for recipes unless mapped
                type: isDeduction ? 'sale' : 'correction',
                amount: quantity,
                reason: virtualReason,
                previousStock: currentStock,
                newStock: currentStock, // Virtual, no change
                UserId: userId,
                AccountId: accountId || null
            }, { transaction });
            console.log(`[Stock] Recorded ProductMovement for recipe item: ${product.name}`);
        } else if (product.isStockManaged) {
            console.log(`[Stock] Product ${product.name} is direct stock managed.`);
            // Handle Direct Stock (No Recipe, e.g. Soda Cans, Beer)

            let targetStockModel = product; // Default to main product
            let isVariant = false;

            if (presentation) {
                console.log(`[Stock] Looking for variant: ${presentation}`);
                // Try to find a matching Variant
                const { ProductVariant } = require('../models');
                const variant = await ProductVariant.findOne({
                    where: {
                        ProductId: productId,
                        name: presentation
                    }
                });

                if (variant) {
                    console.log(`[Stock] Variant found: ${variant.name} ID:${variant.id}`);
                    targetStockModel = variant;
                    isVariant = true;
                } else {
                    console.log(`[Stock] Variant ${presentation} NOT found. Using base product.`);
                }
            }

            // Capture previous stock mostly for logging (approximation) or perform read
            const oldStock = Number(targetStockModel.stock); // This might be stale, but the movement record isn't critical for logic correctness, the DB value is.

            // ATOMIC UPDATE
            if (isDeduction) {
                await targetStockModel.decrement('stock', { by: quantity, transaction });
            } else {
                await targetStockModel.increment('stock', { by: quantity, transaction });
            }

            // Reload to ensure we have fresh data for return/logging
            await targetStockModel.reload({ transaction });
            const newStockValue = Number(targetStockModel.stock);

            // Back-calculate previous for the log (so the log is consistent with the atomic op)
            const previousStockCalc = isDeduction ? newStockValue + quantity : newStockValue - quantity;

            console.log(`[Stock] Updated Stock for ${targetStockModel.name || 'Product'}: ${previousStockCalc} -> ${newStockValue}`);

            // Log Movement for Direct Product/Variant
            // const { ProductMovement } = require('../models');
            console.log(`[Stock] Creating ProductMovement for ${targetStockModel.name}`);
            let directReason = isDeduction ? `Venta: ${product.name} ${isVariant ? '[' + targetStockModel.name + ']' : ''} x${quantity}` : `Restauración: ${product.name} x${quantity}`;
            if (isDeduction && accountId) {
                const { Account } = getModels();
                const acc = await Account.findByPk(accountId);
                if (acc && acc.accountType === 'staff') {
                    directReason = `Consumo Personal: ${product.name} ${isVariant ? '[' + targetStockModel.name + ']' : ''} x${quantity}`;
                }
            }

            await ProductMovement.create({
                ProductId: productId,
                ProductVariantId: isVariant ? targetStockModel.id : null,
                type: isDeduction ? 'sale' : 'correction',
                amount: quantity,
                reason: directReason,
                previousStock: previousStockCalc,
                newStock: newStockValue,
                UserId: userId, // System action or specific user
                AccountId: accountId || null
            }, { transaction });

            // REMOVED: DOUBLE STOCK DEDUCTION BUG FIX
            // Previously, when a variant was sold, we deducted from BOTH the variant AND the parent product.
            // This caused the stock to appear to decrease by 2x (e.g., sell 1 water, stock drops by 2).
            // The frontend already sums (base stock + variant stocks) for display, so updating the parent is redundant.
            // Only the variant stock should be modified to reflect the actual sale.

            // if (isVariant) {
            //     console.log(`[Stock] Updating PARENT Stock for Variant deduction`);
            //     if (isDeduction) {
            //         await product.decrement('stock', { by: quantity });
            //     } else {
            //         await product.increment('stock', { by: quantity });
            //     }
            //     await product.reload();
            //     console.log(`[Stock] Parent Product ${product.name} updated to ${product.stock}`);
            // }

            // Better: Return the affected product IDs and let the Route emit.
            return { success: true, productId, newStock: newStockValue };
        } else if (product.type === 'menu') {
            // Handle Menu Movement Logging (Virtual Stock)
            console.log(`[Stock] Product ${product.name} is a MENU. creating log.`);
            // const { ProductMovement } = require('../models');

            // Create movement log for the Menu itself
            let menuReason = isDeduction ? `Venta: ${product.name} x${quantity}` : `Restauración: ${product.name} x${quantity}`;

            await ProductMovement.create({
                ProductId: productId,
                ProductVariantId: null,
                type: isDeduction ? 'sale' : 'correction',
                amount: quantity,
                reason: menuReason,
                previousStock: 0, // Virtual
                newStock: 0,      // Virtual
                UserId: userId
            }, { transaction });
            console.log(`[Stock] Created ProductMovement for Menu ${product.name}`);
        } else {
            console.log(`[Stock] Product ${product.name} (Type: ${product.type}) has NO Recipes and is NOT StockManaged. No movement recorded.`);
        }

    } catch (err) {
        console.error("[Stock] ERROR processing stock change:", err);
    }
};

// Add Order Items to Account
router.post('/orders', async (req, res) => {
    console.log("[Orders] Received order request", JSON.stringify(req.body));
    const { sequelize, Account, Product, Order } = getModels();
    const t = await sequelize.transaction();

    try {
        const { accountId, products } = req.body;
        let { userId } = req.body; // userId optional

        // Sanitize userId: Ensure it's a valid integer or null
        if (userId !== null && userId !== undefined) {
            const parsedId = parseInt(userId);
            if (isNaN(parsedId) || parsedId <= 0) {
                console.warn(`[Orders] Invalid userId received: "${userId}". Setting to null.`);
                userId = null;
            } else {
                userId = parsedId;
            }
        } else {
            userId = null;
        }


        // 1. VALIDATE STOCK BEFORE PROCESSING
        const stockCheck = await checkStockAvailability(products);
        if (!stockCheck.ok) {
            console.warn("[Orders] Stock validation FAILED:", JSON.stringify(stockCheck.errors));
            await t.rollback();
            return res.status(400).json({
                error: 'Stock insuficiente para completar el pedido',
                details: stockCheck.errors
            });
        }

        const account = await Account.findByPk(accountId, { transaction: t });
        if (!account || account.status !== 'open') {
            await t.rollback();
            return res.status(400).json({ error: 'Cuenta no activa' });
        }

        const createdOrders = [];
        let totalAdd = 0;

        for (const item of products) {
            console.log(`[Orders] Processing item: ${JSON.stringify(item)}`);

            // COMBO ITEMS (2x1 drink promotions have no productId)
            if (item.isCombo || !item.productId) {
                const comboOrder = await Order.create({
                    AccountId: accountId,
                    ProductId: null,
                    quantity: item.quantity || 1,
                    notes: item.notes || item.name || 'Combo',
                    presentation: null,
                    status: 'served',
                    priceAtOrder: parseFloat(item.price) || 0,
                    subItemsData: item.subItems ? JSON.stringify(item.subItems) : null,
                    UserId: userId

                }, { transaction: t });

                // Deduct stock for sub-items (linked products)
                if (item.subItems && Array.isArray(item.subItems)) {
                    for (const sub of item.subItems) {
                        if (sub.productId) {
                            const subQty = (sub.quantity || 1) * (item.quantity || 1);
                            await processStockChange(sub.productId, subQty, true, null, t, userId, accountId);
                        }
                    }
                }

                totalAdd += parseFloat(item.price || 0) * (item.quantity || 1);
                createdOrders.push(comboOrder);
                continue;
            }

            const product = await Product.findByPk(item.productId); // Just basic info for price/name

            if (!product) {
                console.warn(`[Orders] Product ID ${item.productId} NOT FOUND. Skipping.`);
                continue;
            }
            console.log(`[Orders] Found Product: ${product.name} | Price: ${product.price} | Type: ${product.type}`);

            // Determine status: ALWAYS 'served' now
            const initialStatus = 'served';

            // Determine Price based on Presentation (or respect frontend calculated price)
            let finalPrice = parseFloat(product.price);
            let appliedHappyHour = false;

            // Validate Happy Hour logic first. Server time is used to avoid client tampering.
            const now = new Date();
            // Convert current time to "HH:mm:ss" in local time to compare
            const currentHours = String(now.getHours()).padStart(2, '0');
            const currentMinutes = String(now.getMinutes()).padStart(2, '0');
            const currentTimeStr = `${currentHours}:${currentMinutes}`;

            const isHappyHourActive = (startStr, endStr) => {
                if (!startStr || !endStr) return false;
                if (startStr <= endStr) {
                    return currentTimeStr >= startStr && currentTimeStr <= endStr;
                } else {
                    return currentTimeStr >= startStr || currentTimeStr <= endStr;
                }
            };

            const isStaff = account.accountType === 'staff';

            if (isStaff) {
                finalPrice = 0;
                console.log(`[Orders] Staff Account: Forcing price to 0 for ${product.name}`);
            } else if (item.price !== undefined && item.price !== null && !isNaN(parseFloat(item.price))) {
                finalPrice = parseFloat(item.price); // Trust the custom price generated for split items or combos
            } else if (item.presentation && product.presentations) {
                try {
                    const variants = JSON.parse(product.presentations);
                    const variant = variants.find(v => v.name === item.presentation);
                    if (variant) {
                        // Check if variant has Happy Hour
                        if (variant.happyHourPrice && isHappyHourActive(variant.happyHourStart, variant.happyHourEnd)) {
                            finalPrice = parseFloat(variant.happyHourPrice);
                            appliedHappyHour = true;
                        } else {
                            finalPrice = parseFloat(variant.price);
                        }
                    }
                } catch (e) {
                    console.error("Error parsing presentations", e);
                }
            } else {
                // Base Product Happy Hour Check
                if (product.happyHourPrice && isHappyHourActive(product.happyHourStart, product.happyHourEnd)) {
                    finalPrice = parseFloat(product.happyHourPrice);
                    appliedHappyHour = true;
                }
            }

            if (appliedHappyHour) {
                console.log(`[Orders] Happy Hour Applied! Product: ${product.name}, Original: ${product.price}, HH Price: ${finalPrice}`);
            }

            const order = await Order.create({
                AccountId: accountId,
                ProductId: item.productId,
                quantity: item.quantity,
                notes: item.notes,
                presentation: item.presentation || null,
                status: initialStatus,
                priceAtOrder: finalPrice,
                subItemsData: item.subItems ? JSON.stringify(item.subItems) : null,
                UserId: userId // Track who placed the order

            }, { transaction: t });

            // 1. Deduct Stock for Main Product
            console.log(`[Orders] Deducting stock for main product: ${item.productId}, qty: ${item.quantity}, presentation: ${item.presentation}`);
            await processStockChange(item.productId, item.quantity, true, item.presentation, t, userId, accountId);

            // 2. Deduct Stock for SubItems (Menu Components)
            if (item.subItems && Array.isArray(item.subItems)) {
                console.log(`[Orders] Processing ${item.subItems.length} subItems:`, JSON.stringify(item.subItems));
                for (const sub of item.subItems) {
                    // sub = { productId: 123, menuItemId: "item_xyz", quantity: 1, name: "Sopa" }

                    // A. Update Menu Config Stock (Virtual Limit)
                    if (sub.menuItemId) {
                        const totalSubQty = (sub.quantity || 1) * item.quantity;
                        console.log(`[Orders] Updating menu stock for menuItemId: ${sub.menuItemId}, qty: ${totalSubQty}`);
                        await updateDailyMenuStock(sub.menuItemId, totalSubQty, true, t);
                    } else {
                        console.log(`[Orders] SubItem has no menuItemId: ${sub.name}`);
                    }

                    // B. Update Physical Inventory (if linked to a real product)
                    if (sub.productId) {
                        const totalSubQty = (sub.quantity || 1) * item.quantity;
                        console.log(`[Orders] Deducting physical stock for productId: ${sub.productId}, qty: ${totalSubQty}`);
                        await processStockChange(sub.productId, totalSubQty, true, null, t, userId, accountId);
                    } else {
                        console.log(`[Orders] SubItem has no productId (virtual): ${sub.name}`);
                    }
                }
            } else {
                console.log(`[Orders] No subItems for this order`);
            }

            totalAdd += (finalPrice * item.quantity);
            createdOrders.push(order);
        }

        // Update Account Total
        account.total = parseFloat(account.total) + totalAdd;
        await account.save({ transaction: t });

        await t.commit();

        // Notify Kitchen (Socket.io)
        const io = req.app.get('io');
        io.emit('new_order', { accountId, tableId: account.TableId });

        // Force Global Product Refresh
        io.emit('product_updated', {});
        console.log("Socket events emitted (Atomic Update)");

        res.json({ success: true, orders: createdOrders });
    } catch (err) {
        if (t) await t.rollback();
        console.error("[Orders] Error processing order:", err);
        // Return more detail to help debugging 500 errors in production
        res.status(500).json({
            error: err.message,
            details: "Error interno en el servidor al procesar el pedido.",
            stack: process.env.NODE_ENV === 'debug' ? err.stack : undefined
        });
    }
});

// Delete Order (Admin Only)
router.delete('/orders/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { Order, Product, Account } = getModels();
        const order = await Order.findByPk(id, {
            include: [Product]
        });

        if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

        const account = await Account.findByPk(order.AccountId);

        // Calculate data first before deleting order to ensure consistency
        const orderPrice = parseFloat(order.priceAtOrder || 0);
        const orderQty = parseFloat(order.quantity || 1);
        const totalDeduction = orderPrice * orderQty;

        // 1. Delete Order logic first to ensure it's gone from UI immediately
        await order.destroy();

        // 2. Recalculate Account Total safely
        account.total = Math.max(0, parseFloat(account.total) - totalDeduction);
        await account.save();

        // 3. Respond FAST so UI stops loading
        res.json({ success: true, message: 'Pedido eliminado. Restaurando stock en segundo plano...' });

        // 4. Background: Restore Stock & Notify
        (async () => {
            try {
                await restoreOrderStock(order);
                const io = req.app.get('io');
                if (io && account) {
                    io.emit('new_order', { accountId: account.id, tableId: account.TableId });
                    io.emit('product_updated', {});
                }
            } catch (bgErr) {
                console.error("ERROR RESTORING STOCK IN BACKGROUND:", bgErr);
            }
        })();

    } catch (err) {
        console.error("ERROR DELETING ORDER:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- KITCHEN / OPERATIONS ---

// Get All Active Orders (grouped by Account)
// Returns accounts that have orders not 'served' yet
router.get('/orders/pending', async (req, res) => {
    try {
        const { Account, Order, Product, Table, Area, Op } = getModels();

        const accounts = await Account.findAll({
            where: { status: 'open' },
            include: [
                {
                    model: Order,
                    where: {
                        status: { [Op.not]: 'served' } // Only show pending/ready/preparing
                    },
                    required: true, // Only accounts with active orders
                    include: [Product]
                },
                {
                    model: Table,
                    include: [Area]
                }
            ],
            order: [['createdAt', 'ASC']]
        });

        res.json(accounts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Order Status
router.put('/orders/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const { Order } = getModels();

        const order = await Order.findByPk(id);
        if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

        order.status = status;
        await order.save();

        // Notify Socket
        const io = req.app.get('io');
        io.emit('order_updated', { orderId: id, status, accountId: order.AccountId });

        res.json(order);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- REPORTS & CAJA ---

// Get Cashflow Report (Range Supported)
router.get('/reports/daily', async (req, res) => {
    try {
        const { Account, Order, Product, Expense, User } = getModels();
        const { Op } = require('sequelize');
        const { startDate, endDate } = req.query;

        // Use Hotel Day Logic (7 AM to 6:59:59 AM next day)
        const [start, end] = getHotelDayRange(startDate, endDate);

        const { Payment } = getModels();
        // 1. All Payments (Income)
        const payments = await Payment.findAll({
            where: {
                createdAt: {
                    [Op.between]: [start, end]
                }
            },
            include: [
                { model: getModels().User, attributes: ['username', 'displayName'] },
                {
                    model: Account,
                    include: [
                        { model: Order, include: [Product] },
                        { model: Payment },
                        { model: getModels().Table, include: [getModels().Area] }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Some legacy accounts might not have individual payments logged in the new table (before migration). 
        // We might miss historical "closed" accounts that have no Payment rows. But for "now that we implemented partial payments", 
        // relying on Payments is the correct forward path.
        const totalSales = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

        // To keep the 'closedCount' stat roughly correct, we can independently fetch closed accounts
        const closedCount = await Account.count({
            where: { status: 'closed', closedAt: { [Op.between]: [start, end] } }
        });

        // 2. Expenses (Outcome)
        // 2. Expenses (Outcome)
        const expenses = await Expense.findAll({
            where: {
                date: {
                    [Op.between]: [start, end]
                }
            },
            include: [{ model: User, attributes: ['username', 'displayName'] }]
        });

        const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

        // 3. Open Accounts (Pending) - Snapshot (not time bound usually, just current)
        // If viewing past dates, "Pending" doesn't make much sense, but we can keep current pending as reference.
        const openAccounts = await Account.findAll({
            where: { status: 'open' },
            include: [
                { model: Order, include: [Product] },
                { model: getModels().Table, include: [getModels().Area] }
            ]
        });
        const totalPending = openAccounts.reduce((sum, acc) => sum + parseFloat(acc.total), 0);

        // 4. Global Cash (All time? Or just this period?)
        // User asked for "Efectivo en Caja (Real)". Usually implies Physical Cash.
        // We can approximate by Sum(All Cash Sales) - Sum(All Cash Expenses).
        // For now, let's return the range balance.

        // GLOBAL CASH CALCULATION (Expensive, but requested)
        // Optimization: Maybe store running balance in a separate table later.
        const allCashPayments = await Payment.findAll({
            where: { method: 'efectivo' },
            attributes: ['amount']
        });
        const totalCashIncome = allCashPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

        const allCashExpenses = await Expense.findAll({
            where: { paymentMethod: 'efectivo' },
            attributes: ['amount']
        });
        const totalCashOutcome = allCashExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

        const currentCashBalance = totalCashIncome - totalCashOutcome;

        res.json({
            date: start.toISOString().split('T')[0],
            range: { start, end },
            totalSales,
            totalExpenses,
            balance: totalSales - totalExpenses,
            currentCashBalance, // Global Cash
            totalPending,
            closedCount: closedCount,
            openCount: openAccounts.length,
            movements: payments, // Payments List
            expenses: expenses,        // Expenses List
            active: openAccounts
        });
    } catch (err) {
        console.error("ERROR GENERATING REPORT:", err);
        console.error("Full Error details:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
        res.status(500).json({
            error: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// Get Sales/Orders for Products (Sales History)
router.get('/products/sales', async (req, res) => {
    try {
        const { type } = req.query; // e.g. 'dish' for prepared products
        const { Order, Product, Account, Table, User } = require('../models');

        const productWhere = {};
        if (type) {
            const types = type.split(',');
            productWhere.type = types;
        }

        // First, get orders with Product and Account (no nested Table)
        const orders = await Order.findAll({
            include: [
                {
                    model: Product,
                    attributes: ['name', 'type'],
                    where: Object.keys(productWhere).length > 0 ? productWhere : undefined,
                    required: true
                },
                {
                    model: Account,
                    attributes: ['id', 'customerName', 'TableId'],
                    required: false
                },
                {
                    model: User,
                    attributes: ['username', 'displayName'],
                    required: false
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: 100
        });

        // Manually fetch Table names WITH AREA for each account
        const tableIds = [...new Set(orders.map(o => o.Account?.TableId).filter(Boolean))];
        const { Area } = require('../models');
        const tables = await Table.findAll({
            where: { id: tableIds },
            attributes: ['id', 'number', 'AreaId'],
            include: [{
                model: Area,
                attributes: ['name']
            }]
        });

        const tableMap = {};
        tables.forEach(t => {
            // Format as "AreaName + TableNumber" (e.g., "A2", "B1", "Vip3")
            const areaPrefix = t.Area?.name || '';
            tableMap[t.id] = `${areaPrefix}${t.number}`;
        });

        // Add table names to the response
        const ordersWithTables = orders.map(order => {
            const orderJSON = order.toJSON();
            if (orderJSON.Account && orderJSON.Account.TableId) {
                orderJSON.Account.Table = {
                    name: tableMap[orderJSON.Account.TableId] || 'N/A'
                };
            }
            return orderJSON;
        });

        res.json(ordersWithTables);
    } catch (err) {
        console.error("Error loading product sales:", err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE Payment (Admin Only)
router.delete('/payments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query; // Expecting admin userId
        const { Payment, User } = require('../models');

        const user = await User.findByPk(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Solo los administradores pueden eliminar movimientos.' });
        }

        const payment = await Payment.findByPk(id);
        if (!payment) return res.status(404).json({ error: 'Pago no encontrado' });

        await payment.destroy();
        res.json({ success: true, message: 'Pago eliminado correctamente.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
