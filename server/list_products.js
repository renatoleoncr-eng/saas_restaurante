async function listProducts() {
    try {
        const res = await fetch('http://localhost:3003/api/products');
        const products = await res.json();
        console.log("--- Products ---");
        products.forEach(p => {
            console.log(`ID: ${p.id} | Name: ${p.name} | Type: ${p.type} | Cat: ${p.category}`);
        });
    } catch (e) {
        console.error(e);
    }
}
listProducts();
