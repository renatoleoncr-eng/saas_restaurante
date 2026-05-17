const axios = require('axios');

async function testPost() {
    try {
        const payload = {
            tipo: 'boleta',
            clienteDocumento: '70132947',
            clienteNombre: 'RENATO ARTURO LEON CRUZ',
            clienteDireccion: '',
            items: [
                {
                    description: 'Test Item',
                    quantity: 1,
                    amount: 10
                }
            ],
            userId: 1
        };
        const res = await axios.post('http://127.0.0.1:3003/api/billing/invoices', payload);
        console.log("POST status:", res.status, "data:", res.data);
    } catch (err) {
        console.log("POST error status:", err.response?.status, "data:", err.response?.data || err.message);
    }
}

testPost();
