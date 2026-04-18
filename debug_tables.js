const { Table, Area } = require('./server/models');

async function checkData() {
    try {
        const tables = await Table.findAll({ include: [Area] });
        console.log("=== TABLES DATA ===");
        tables.forEach(t => {
            console.log(`Table ID: ${t.id}, Number: ${t.number}, AreaId: ${t.AreaId}, Area Name: ${t.Area?.name || 'NULL'}`);
        });

        const areas = await Area.findAll();
        console.log("\n=== AREAS DATA ===");
        areas.forEach(a => {
            console.log(`Area ID: ${a.id}, Name: ${a.name}`);
        });

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

checkData();
