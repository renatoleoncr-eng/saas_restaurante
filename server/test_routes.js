const axios = require('axios');

async function test() {
    try {
        const resHealth = await axios.get('http://127.0.0.1:3003/api/health');
        console.log("Health status:", resHealth.data);
    } catch (err) {
        console.log("Health error:", err.message);
    }

    try {
        const resInvoices = await axios.get('http://127.0.0.1:3003/api/billing/invoices');
        console.log("Invoices status:", resInvoices.status, "data length:", resInvoices.data.length);
    } catch (err) {
        console.log("Invoices error status:", err.response?.status, "message:", err.response?.data || err.message);
    }
}

test();
