async function test() {
    const API = 'https://makala.maksuites.com.pe/api';
    try {
        // 1. Get Tables to find a free one
        const tablesRes = await fetch(`${API}/tables`);
        const tables = await tablesRes.json();
        const freeTable = tables.find(t => t.status === 'free');
        if (!freeTable) {
            console.log("No free tables found");
            return;
        }

        console.log("Using table:", freeTable.id);

        // 2. Open Account
        const accountRes = await fetch(`${API}/accounts/open`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tableId: freeTable.id,
                customerName: "Test Auto",
                accountType: "standard"
            })
        });
        const account = await accountRes.json();
        const accountId = account.id;
        console.log("Opened account:", accountId);

        // 3. Place Order for Ceviche Congrio (id: 46)
        const orderRes = await fetch(`${API}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accountId: accountId,
                products: [{
                    productId: 46,
                    quantity: 1,
                    notes: "Test Validation"
                }]
            })
        });
        const order = await orderRes.json();
        console.log("Order placed:", order.success);

        // 4. Cancel the account to free the table
        await fetch(`${API}/accounts/${accountId}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkEmpty: false })
        });
        console.log("Account cancelled.");

        // 5. Check Movements
        const movRes = await fetch(`${API}/products/movements/all?isStockManaged=false&requiresPreparation=false&excludeMenu=true`);
        const movements = await movRes.json();
        const myMov = movements.find(m => m.ProductId === 46 && m.reason.includes("Test Auto"));
        
        console.log("Movements length:", movements.length);
        console.log("Recent movements:", movements.slice(0, 3).map(m => ({ id: m.id, reason: m.reason, type: m.type })));

    } catch(err) {
        console.error("Error:", err.message);
    }
}
test();
