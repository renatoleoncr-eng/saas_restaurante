const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3003,
    path: '/api/menu/daily',
    method: 'GET'
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log('API Response Status:', res.statusCode);
        const json = JSON.parse(data);
        console.log('Entries Count:', json.entries ? json.entries.length : 0);
        console.log('Mains Count:', json.mains ? json.mains.length : 0);

        if (json.mains && json.mains.length > 0) {
            console.log('First Main:', JSON.stringify(json.mains[0]));
        } else {
            console.log('Mains is Empty!');
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.end();
