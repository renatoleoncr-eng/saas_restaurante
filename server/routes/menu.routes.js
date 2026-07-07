const express = require('express');
const router = express.Router();
const { DailyMenu, Op } = require('../models');

// GET Daily Menu for a specific date (or today)
router.get('/menu/daily', async (req, res) => {
    try {
        const { date } = req.query;
        // Default to today if not provided
        // Logic: "Today" in local time. Client usually sends YYYY-MM-DD.
        // If no date, use server today.

        // Helper for Peru Local Time (UTC-5)
        const getLocalDateStr = () => {
            const now = new Date();
            now.setHours(now.getHours() - 5);
            return now.toISOString().split('T')[0];
        };

        let queryDate = date;
        if (!queryDate) {
            queryDate = getLocalDateStr();
        }

        const menu = await DailyMenu.findOne({
            where: { date: queryDate, TenantId: req.tenant.id }
        });

        if (!menu) {
            // Return empty structure if not found
            return res.json({
                date: queryDate,
                price: 0,
                entries: [],
                mains: []
            });
        }

        // Parse JSON strings back to arrays
        let entriesList = JSON.parse(menu.entries || '[]');
        let mainsList = JSON.parse(menu.mains || '[]');

        // Compatibility Fix: If mains is empty but entries contains 'main' category items
        // This handles the new frontend save format where everything goes into 'entries'
        if (mainsList.length === 0 && entriesList.some(e => e.category === 'main')) {
            mainsList = entriesList.filter(e => e.category === 'main');
            entriesList = entriesList.filter(e => e.category !== 'main');
        }

        // Populate Product IDs for Menu Groups
        // This allows frontend to know the Real Product ID for "Menu Ejecutivo" etc.
        const { Product } = require('../models');
        const allItems = [...entriesList, ...mainsList];
        const groupNames = [...new Set(allItems.map(i => i.groupName).filter(n => n))];
        const productMap = {};

        if (groupNames.length > 0) {
            const products = await Product.findAll({
                where: { name: groupNames, TenantId: req.tenant.id },
                attributes: ['id', 'name', 'price']
            });
            products.forEach(p => {
                productMap[p.name] = p.id;
            });
        }

        res.json({
            ...menu.toJSON(),
            entries: entriesList,
            mains: mainsList,
            productMap // Send map to frontend
        });

    } catch (err) {
        console.error("Error fetching daily menu:", err);
        res.status(500).json({ error: err.message });
    }
});

// POST/PUT Daily Menu
router.post('/menu/daily', async (req, res) => {
    try {
        const { date, price, entries, mains } = req.body;

        if (!date) return res.status(400).json({ error: 'Date is required' });

        const { Product } = require('../models');

        // Upsert logic — scoped to tenant
        const [menu, created] = await DailyMenu.findOrCreate({
            where: { date, TenantId: req.tenant.id },
            defaults: {
                price: price || 0,
                entries: JSON.stringify(entries || []),
                mains: JSON.stringify(mains || []),
                TenantId: req.tenant.id
            }
        });

        if (!created) {
            menu.price = price !== undefined ? price : menu.price;
            menu.entries = entries !== undefined ? JSON.stringify(entries) : menu.entries;
            menu.mains = mains !== undefined ? JSON.stringify(mains) : menu.mains;
            await menu.save();
        }

        // --- NEW: SYNC PRODUCTS With Menu Groups ---
        // Ensure that for every groupName, there is a corresponding Product in the DB
        // allowing the POS to link to it.
        const allItems = [...(entries || []), ...(mains || [])];
        const uniqueGroups = {};

        allItems.forEach(item => {
            if (item.groupName) {
                // Use the last seen price for the group
                uniqueGroups[item.groupName] = {
                    name: item.groupName,
                    price: item.menuPrice || 0
                };
            }
        });


        for (const gName in uniqueGroups) {
            const gData = uniqueGroups[gName];

            // Find or Create the "Menu" Product — scoped to tenant
            const [prod, wasCreated] = await Product.findOrCreate({
                where: { name: gName, TenantId: req.tenant.id },
                defaults: {
                    name: gName,
                    price: gData.price,
                    type: 'menu',
                    stock: 999,
                    isStockManaged: false,
                    description: 'Generado automáticamente desde Configuración de Menú',
                    TenantId: req.tenant.id
                }
            });

            // Update price if changed (and it's a menu type product)
            if (!wasCreated && prod.type === 'menu') {
                if (parseFloat(prod.price) !== parseFloat(gData.price)) {
                    console.log(`[MenuSync] Updating price for ${gName}: ${prod.price} -> ${gData.price}`);
                    prod.price = gData.price;
                    await prod.save();
                }
            }
        }

        res.json({ success: true, menu });
    } catch (err) {
        console.error("Error saving daily menu:", err);
        res.status(500).json({ error: err.message });
    }
});

// GET Menu Sales History (Structured)
router.get('/menu/sales', async (req, res) => {
    try {
        const { Order, Product, User } = require('../models');

        // Fetch last 100 Menu Orders scoped to tenant
        const orders = await Order.findAll({
            where: { TenantId: req.tenant.id },
            limit: 100,
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: Product,
                    where: { type: 'menu', TenantId: req.tenant.id },
                    attributes: ['name', 'price']
                },
                {
                    model: User,
                    attributes: ['username', 'displayName']
                }
            ]
        });

        // Resolve SubItems (Entries/Mains)
        // 1. Collect all Product IDs from subItemsData to fetch their names in bulk
        const productIds = new Set();
        orders.forEach(o => {
            try {
                if (o.subItemsData) {
                    const subs = JSON.parse(o.subItemsData);
                    subs.forEach(s => productIds.add(s.productId));
                }
            } catch (e) { }
        });

        const { Product: ProductModel } = require('../models');
        const productMap = {};
        if (productIds.size > 0) {
            const products = await ProductModel.findAll({
                where: { id: Array.from(productIds) },
                attributes: ['id', 'name', 'type'],
                paranoid: false
            });
            products.forEach(p => productMap[p.id] = p);
        }

        // 2. Build Response
        const sales = orders.map(o => {
            let entry = '---';
            let main = '---';
            let other = [];

            try {
                if (o.subItemsData) {
                    const subs = JSON.parse(o.subItemsData);
                    subs.forEach(s => {
                        const p = productMap[s.productId];
                        if (p) {
                            if (p.type === 'daily_entry') entry = p.name;
                            else if (p.type === 'daily_main') main = p.name;
                            else other.push(p.name);
                        }
                    });
                }
            } catch (e) { }

            let dynamicName = o.presentation || o.Product.name;
            if (o.notes && o.notes.startsWith('Solo')) {
                dynamicName = o.notes;
            }

            return {
                id: o.id,
                date: o.createdAt,
                menuName: dynamicName, // Use presentation or specific note for dynamic names if available
                price: o.priceAtOrder !== undefined && o.priceAtOrder !== null ? o.priceAtOrder : o.Product.price, // Respect cart custom price 
                entry,
                main,
                user: o.User ? (o.User.displayName || o.User.username) : 'Sistema',
                accountId: o.AccountId
            };
        });

        res.json(sales);

    } catch (err) {
        console.error("Error fetching menu sales:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
