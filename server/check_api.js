const axios = require('axios');
async function run() {
    try {
        const res = await axios.get('http://127.0.0.1:5000/api/products/movements/all?isStockManaged=false&requiresPreparation=false&excludeMenu=true', {
            headers: { 'Tenant-Id': '1' }
        });
        const movements = res.data;
        const cevicheMovs = movements.filter(m => m.Product && m.Product.name.includes('Ceviche'));
        console.log("Movements returned:", cevicheMovs.map(m => ({ id: m.id, date: m.createdAt, name: m.Product.name })));
    } catch(e) {
        console.error(e.message);
    }
}
run();
