async function run() {
    try {
        const res = await fetch('http://localhost:3004/api/validate-pin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Slug': 'makala'
            },
            body: JSON.stringify({ pin: '2606' })
        });
        const text = await res.text();
        console.log(res.status, text);
    } catch (e) {
        console.error(e);
    }
}
run();
