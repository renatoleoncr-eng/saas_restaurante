async function testApi() {
    try {
        const res = await fetch('http://localhost:3003/api/accounts/all?status=all');
        const data = await res.json();
        const acc24 = data.find(a => a.id === 24);
        console.log("Account 24 API Response:", acc24);
    } catch (e) {
        console.error("Error calling API:", e.message);
    }
}
testApi();
