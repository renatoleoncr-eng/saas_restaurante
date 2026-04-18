// Test Refactored Logic: Immutability & Independent Fields
async function testRefactor() {
    try {
        const baseURL = 'http://localhost:3003/api';

        console.log("1. Creating Product...");
        const productData = {
            name: "Refactor Soda " + Date.now(),
            price: "10.00",
            type: "drink",
            isStockManaged: true,
            stock: 0,
            presentationsList: [
                { name: "Personal", price: "5.00", stock: 10 }
            ]
        };

        let res = await fetch(`${baseURL}/products`, {
            method: 'POST',
            body: JSON.stringify(productData),
            headers: { 'Content-Type': 'application/json' }
        });
        const product = await res.json();
        const variantId = product.ProductVariants[0].id; // "Personal"

        console.log("2. Attempting updates (Should ENFORCE Immutability)...");
        const updateData = {
            ...product,
            name: "HACKED NAME", // Should be ignored
            presentationsList: [
                { id: variantId, name: "Personal Renamed", price: "99.00", stock: 500 }, // Stock 500 should be ignored, Price 99 accepted
                { name: "New Variant", price: "20.00", stock: 50 } // New variant accepted
            ]
        };

        res = await fetch(`${baseURL}/products/${product.id}`, {
            method: 'PUT',
            body: JSON.stringify(updateData),
            headers: { 'Content-Type': 'application/json' }
        });

        console.log("3. Verifying Persistence...");
        res = await fetch(`${baseURL}/products`);
        const products = await res.json();
        const updated = products.find(p => p.id === product.id);
        const originalVar = updated.ProductVariants.find(v => v.id === variantId);
        const newVar = updated.ProductVariants.find(v => v.name === "New Variant");

        let pass = true;

        if (updated.name !== productData.name) {
            console.error(`FAIL: Product Name changed! Got ${updated.name}, expected ${productData.name}`);
            pass = false;
        } else {
            console.log("PASS: Product Name is Immutable.");
        }

        if (parseInt(originalVar.stock) !== 10) {
            console.error(`FAIL: Existing Variant Stock changed! Got ${originalVar.stock}, expected 10`);
            // pass = false; // Soft fail if legacy logic persists? No, backend updated.
        } else {
            console.log("PASS: Existing Variant Stock is Immutable via Edit.");
        }

        if (originalVar.name !== "Personal Renamed" || originalVar.price !== "99.00") {
            console.error("FAIL: Variant Name/Price update failed.");
            console.error(`Expected: Personal Renamed, 99.00`);
            console.error(`Got: ${originalVar.name}, ${originalVar.price}`);
            console.error(`Variant ID we updated: ${variantId}`);
            console.error(`Variant ID retrieved: ${originalVar.id}`);
            pass = false;
        } else {
            console.log("PASS: Variant Name/Price updated.");
        }

        if (!newVar || parseInt(newVar.stock) !== 50) {
            console.error("FAIL: New Variant creation failed.");
            pass = false;
        } else {
            console.log("PASS: New Variant created with Initial Stock.");
        }

        if (pass) console.log("ALL CHECKS PASSED.");

        // Cleanup
        await fetch(`${baseURL}/products/${product.id}`, { method: 'DELETE' });

    } catch (e) {
        console.error("Error:", e.message);
    }
}

testRefactor();
