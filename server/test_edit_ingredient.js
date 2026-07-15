const axios = require('axios');

async function test() {
    try {
        const res = await axios.post('http://localhost:3000/api/stock/ingredients', {
            id: 1, // dummy id
            name: 'Chicharron de pollo test',
            unit: 'Unidades'
        }, {
            headers: {
                'Authorization': 'Bearer 1', // We need a valid token... wait, it's easier to test against db directly
            }
        });
        console.log(res.data);
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}

test();
