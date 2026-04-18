#!/usr/bin/env node
// test_libre.js — Tests if requiresPreparation=false is properly saved via HTTP
const http = require('http');

const SERVER_PORT = 3003; // Matches server/index.js PORT

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const bodyStr = body ? JSON.stringify(body) : null;
        const options = {
            hostname: 'localhost',
            port: SERVER_PORT,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

async function run() {
    console.log(`Testing server on localhost:${SERVER_PORT}...\n`);

    // 1. Get all products to find Pan
    const listRes = await request('GET', '/api/products');
    if (listRes.status !== 200) {
        console.error(`❌ GET /api/products failed with status ${listRes.status}`);
        console.error(listRes.body);
        return;
    }

    const products = listRes.body;
    const pan = products.find(p => p.name === 'Pan');
    if (!pan) {
        console.error("❌ Product 'Pan' not found. Available:", products.map(p => `${p.id}:${p.name}`).join(', '));
        return;
    }

    console.log(`✅ Found 'Pan': ID=${pan.id}, requiresPreparation=${pan.requiresPreparation}, isStockManaged=${pan.isStockManaged}`);
    console.log(`   Initial state: ${pan.requiresPreparation ? '🟢 Preparado' : '🟠 Libre'}`);

    // 2. Send PUT to set it as Libre (requiresPreparation=false)
    console.log(`\n📤 Sending PUT /api/products/${pan.id} with requiresPreparation=false ...`);
    const putPayload = {
        name: pan.name,
        price: pan.price,
        type: pan.type,
        isStockManaged: false,
        requiresPreparation: false,  // <-- This is the key field
        stock: pan.stock || 0,
        presentationsList: []
    };
    console.log('   Payload:', JSON.stringify(putPayload));

    const putRes = await request('PUT', `/api/products/${pan.id}`, putPayload);
    console.log(`   Response status: ${putRes.status}`);

    if (putRes.status !== 200) {
        console.error(`❌ PUT failed:`, putRes.body);
        return;
    }

    const updated = putRes.body;
    console.log(`   Response requiresPreparation: ${updated.requiresPreparation}`);

    if (updated.requiresPreparation === false) {
        console.log(`✅ SUCCESS: Server correctly saved requiresPreparation=false`);
    } else {
        console.error(`❌ FAIL: Server returned requiresPreparation=${updated.requiresPreparation} (expected false)`);
    }

    // 3. Verify with a fresh GET
    console.log(`\n📥 Verifying with fresh GET /api/products/${pan.id}...`);
    const verifyRes = await request('GET', `/api/products/${pan.id}`);
    if (verifyRes.status === 200) {
        const fresh = verifyRes.body;
        console.log(`   Fresh DB read: requiresPreparation=${fresh.requiresPreparation}`);
        if (fresh.requiresPreparation === false) {
            console.log(`✅ DB CONFIRMED: requiresPreparation is false in the database`);
        } else {
            console.error(`❌ DB FAIL: requiresPreparation is still ${fresh.requiresPreparation} in DB`);
        }
    } else {
        // Try via list
        const list2 = await request('GET', '/api/products');
        const fresh = list2.body.find(p => p.id === pan.id);
        if (fresh) {
            console.log(`   Fresh list read: requiresPreparation=${fresh.requiresPreparation}`);
        }
    }
}

run().catch(err => {
    console.error('Script error:', err.message);
    console.error('Make sure the server is running on port', SERVER_PORT);
});
