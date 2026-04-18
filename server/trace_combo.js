(async () => {
    try {
        // Run fetch request to place a combo order locally
        const menuRes = await fetch('http://localhost:3003/api/menu/daily');
        const menu = await menuRes.json();

        if (!menu.entries || menu.entries.length < 2) {
            console.log("No menu entries found to order.");
            return;
        }

        const entryToOrder = menu.entries.find(e => e.category === 'entry');
        const mainToOrder = menu.entries.find(m => m.category === 'main');

        if (!entryToOrder || !mainToOrder) {
            console.log("Could not find both Entry and Main");
            return;
        }

        console.log(`Initial Stock - Entry ${entryToOrder.name} [ID: ${entryToOrder.id}]: ${entryToOrder.stock}, Main ${mainToOrder.name} [ID: ${mainToOrder.id}]: ${mainToOrder.stock}`);

        const layoutRes = await fetch('http://localhost:3003/api/layout/tables');
        const layout = await layoutRes.json();
        let table = layout.find(t => t.Accounts && t.Accounts.length > 0 && t.Accounts[0].status === 'open');
        let accountId = table ? table.Accounts[0].id : 96;

        const productsRes = await fetch('http://localhost:3003/api/products');
        const products = await productsRes.json();
        const pMenu = products.find(p => p.name === entryToOrder.groupName);

        const cart = [{
            productId: pMenu.id,
            quantity: 1,
            notes: "Test order combo",
            presentation: null,
            subItems: [
                {
                    productId: entryToOrder.linkId || null,
                    menuItemId: entryToOrder.id || null,
                    quantity: 1,
                    name: entryToOrder.name,
                    price: entryToOrder.menuPrice || 0
                },
                {
                    productId: mainToOrder.linkId || null,
                    menuItemId: mainToOrder.id || null,
                    quantity: 1,
                    name: mainToOrder.name,
                    price: mainToOrder.menuPrice || 0
                }
            ]
        }];

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
        if (orderData.error) {
            console.error("Order Failed", orderData);
        } else {
            console.log("Order placed:", orderData.success);
        }

        const menuRes2 = await fetch('http://localhost:3003/api/menu/daily');
        const menu2 = await menuRes2.json();
        const entryAfter = menu2.entries.find(e => e.id === entryToOrder.id);
        const mainAfter = menu2.entries.find(m => m.id === mainToOrder.id);

        console.log(`Final Stock - Entry ${entryAfter.name}: ${entryAfter.stock} (Expected: ${entryToOrder.stock - 1})`);
        console.log(`Final Stock - Main ${mainAfter.name}: ${mainAfter.stock} (Expected: ${mainToOrder.stock - 1})`);

    } catch (err) {
        console.error("Error:", err);
    }
})();
