const { Area, Table, sequelize } = require('./models');

(async () => {
    try {
        console.log("--- VPS DATABASE DIAGNOSTIC ---");

        // Check Areas
        const areas = await Area.findAll();
        console.log(`\nAreas Found: ${areas.length}`);
        areas.forEach(a => {
            console.log(`- ID: ${a.id} | Name: "${a.name}"`);
        });

        // Check Tables
        const allTables = await Table.findAll();
        console.log(`\nTotal Tables Found: ${allTables.length}`);
        allTables.forEach(t => {
            console.log(`- ID: ${t.id} | Number: "${t.number}" | AreaId: ${t.AreaId} | Status: ${t.status}`);
        });

        // Check for "Orphan" tables
        const [orphans] = await sequelize.query("SELECT id, number FROM Tables WHERE AreaId IS NULL");
        if (orphans.length > 0) {
            console.log(`\nFound ${orphans.length} orphan tables (no Area link):`);
            orphans.forEach(o => console.log(`  - Mesa ${o.number} (id: ${o.id})`));
        }

        console.log("\n--- DIAGNOSTIC COMPLETE ---");
        process.exit(0);
    } catch (err) {
        console.error("Diagnostic failed:", err);
        process.exit(1);
    }
})();
