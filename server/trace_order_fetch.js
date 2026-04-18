(async () => {
    try {
        // 1. Get Daily Menu to find an entry to order
        const menuRes = await fetch('http://localhost:3003/api/menu/daily');
        const menu = await menuRes.json();
        if (!menu.entries || menu.entries.length === 0) {
            console.log("No menu entries found to order.");
            return;
        }

        const entryToOrder = menu.entries[0];
        console.log("Ordering entry:", entryToOrder.name, "ID:", entryToOrder.id, "Stock:", entryToOrder.stock);

        // 2. Hardcode account based on screenshot
        let accountId = 94;

        // 3. Find Product for "Menú del Día"
        const productsRes = await fetch('http://localhost:3003/api/products');
        const products = await productsRes.json();
        const pMenu = products.find(p => p.name === entryToOrder.groupName);
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
        const orderRes = await fetch('http://localhost:3003/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accountId,
                products: cart,
                userId: 1
            })
        });

        const orderData = await orderRes.json();
        console.log("Order placed:", orderData);

        // 5. Check menu stock again
        const menuRes2 = await fetch('http://localhost:3003/api/menu/daily');
        const menu2 = await menuRes2.json();
        const entryAfter = menu2.entries.find(e => e.id === entryToOrder.id);
        console.log(`Stock After: ${entryAfter.stock} (Expected: ${entryToOrder.stock - 1})`);

    } catch (err) {
        console.error("Error:", err);
    }
})();
