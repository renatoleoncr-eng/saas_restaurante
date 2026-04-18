const { Area, Table } = require('./models');

(async () => {
    try {
        const areas = await Area.findAll({
            include: [{ model: Table }]
        });

        console.log(`Found ${areas.length} areas.`);
        areas.forEach(a => {
            const tables = a.Tables || [];
            console.log(`Area: "${a.name}" (ID: ${a.id}) | Tables: ${tables.length}`);
            tables.forEach(t => {
                console.log(`  Table: ${t.number} (ID: ${t.id})`);
            });
        });

        const allTables = await Table.findAll();
        console.log(`Total Tables in DB: ${allTables.length}`);
        allTables.forEach(t => {
            if (!t.AreaId) {
                console.log(`  Floating Table: ${t.number} (ID: ${t.id}) - No Area!`);
            }
        });

    } catch (err) {
        console.error("Error:", err);
    }
})();
