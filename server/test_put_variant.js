async function testPut() {
    try {
        const payload = {
            id: 13,
            name: "Pilsen Turno Noche",
            price: 0,
            type: "drink",
            isStockManaged: true,
            stock: 0,
            requiresPreparation: true,
            presentationsList: [
                {
                    id: 47,
                    name: "Personal",
                    price: 13,
                    stock: 48,
                    happyHourPrice: "11.00",
                    happyHourStart: "10:00",
                    happyHourEnd: "22:00"
                }
            ],
            category: null,
            linkedProductId: null
        };

        console.log("Sending PUT request...");
        const res = await fetch('http://localhost:3003/api/products/13', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log("Response status:", res.status);
        console.log("Response variants:", data.ProductVariants);

        // Also check DB directly
        const { ProductVariant } = require('./models');
        const v = await ProductVariant.findByPk(47);
        console.log("DB Variant 47:", v.toJSON());
    } catch (err) {
        console.error("Error:", err);
    }
}

testPut();
