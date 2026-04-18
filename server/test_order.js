async function test() {
    try {
        console.log("Fetching tables to find an occupied one...");
        const tablesRes = await fetch('http://localhost:3003/api/tables');
        const tables = await tablesRes.json();
        const occupiedTable = tables.find(t => t.status === 'occupied');

        let accountId = null;

        if (occupiedTable) {
            console.log("Found occupied table:", occupiedTable.id, "Name:", occupiedTable.number);
            const accRes = await fetch('http://localhost:3003/api/accounts/table/' + occupiedTable.id);
            const account = await accRes.json();
            if (account && account.id) {
                accountId = account.id;
                console.log("Using account:", accountId);
            }
        }

        if (!accountId) {
            console.log("No open accounts found. Creating one on a free table...");
            const freeTable = tables.find(t => t.status === 'free');
            if (!freeTable) return console.log("No free tables either!");

            const res = await fetch('http://localhost:3003/api/accounts/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tableId: freeTable.id, customerName: 'Test Platos' })
            });
            const account = await res.json();
            accountId = account.id;
            console.log("Created account:", accountId);
        }

        const prodRes = await fetch('http://localhost:3003/api/products');
        const products = await prodRes.json();
        const plato = products.find(p => p.type === 'dish');
        console.log("Found plato:", plato.id, plato.name);

        console.log("Sending order...");
        const orderRes = await fetch('http://localhost:3003/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accountId: accountId,
                products: [{ productId: plato.id, quantity: 1 }],
                userId: 1
            })
        });

        const status = orderRes.status;
        const text = await orderRes.text();
        console.log(`Order response: ${status} - ${text}`);
    } catch (e) {
        console.error("Script error:", e);
    }
}

test();
