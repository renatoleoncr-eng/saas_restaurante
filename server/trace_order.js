const axios = require('axios');

(async () => {
    try {
        // 1. Get Daily Menu to find an entry to order
        const menuRes = await axios.get('http://localhost:3000/api/menu/daily');
        const menu = menuRes.data;
        if (!menu.entries || menu.entries.length === 0) {
            console.log("No menu entries found to order.");
            return;
        }

        const entryToOrder = menu.entries[0];
        console.log("Ordering entry:", entryToOrder.name, "ID:", entryToOrder.id, "Stock:", entryToOrder.stock);

        // 2. We need a target account (create a temporary pos account / table)
        // Or we just find an open account or open one.
        const layoutRes = await axios.get('http://localhost:3000/api/layout/tables');
        let table = layoutRes.data.find(t => t.Accounts && t.Accounts.length > 0 && t.Accounts[0].status === 'open');
        let accountId;

        if (table) {
            accountId = table.Accounts[0].id;
        } else {
            console.log("No open accounts. Please manually open a table in the UI first.");
            // Or just mock it if we can.
            return;
        }

        // 3. Find Product for "Menú del Día" (or whatever group name is)
        const productsRes = await axios.get('http://localhost:3000/api/products');
        const pMenu = productsRes.data.find(p => p.name === entryToOrder.groupName);
        if (!pMenu) {
            console.log("Could not find product for menu group:", entryToOrder.groupName);
            return;
        }

        // 4. Build cart payload
        const cart = [{
            productId: pMenu.id,
            quantity: 1,
            notes: "Test order logic",
            presentation: null,
            subItems: [{
                productId: entryToOrder.linkId || null,
                menuItemId: entryToOrder.id || null,
                quantity: 1,
                name: entryToOrder.name,
                price: entryToOrder.menuPrice || 0
            }]
        }];

        console.log("Sending order payload:", JSON.stringify({ accountId, products: cart }));
        const orderRes = await axios.post('http://localhost:3000/api/orders', {
            accountId,
            products: cart,
            userId: 1
        });

        console.log("Order placed successfully.", orderRes.data);

        // 5. Check menu stock again
        const menuRes2 = await axios.get('http://localhost:3000/api/menu/daily');
        const entryAfter = menuRes2.data.entries.find(e => e.id === entryToOrder.id);
        console.log(`Stock After: ${entryAfter.stock} (Expected: ${entryToOrder.stock - 1})`);

    } catch (err) {
        console.error("Error:", err.response ? err.response.data : err.message);
    }
})();
