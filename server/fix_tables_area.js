// Fix: Restore AreaId=1 on all restaurant tables that lost their area link
const { sequelize } = require('./models');

(async () => {
    try {
        // Check which tables have null AreaId
        const [nullTables] = await sequelize.query("SELECT id, number FROM Tables WHERE AreaId IS NULL AND number NOT IN ('FlowT', 'RepT')");
        console.log(`Found ${nullTables.length} tables with null AreaId:`, nullTables.map(t => `${t.number}(id:${t.id})`).join(', '));

        if (nullTables.length > 0) {
            const [result] = await sequelize.query("UPDATE Tables SET AreaId=1 WHERE AreaId IS NULL AND number NOT IN ('FlowT','RepT')");
            console.log('Updated tables:', result);
        }

        // Verify
        const [fixed] = await sequelize.query("SELECT id, number, AreaId FROM Tables WHERE AreaId=1 ORDER BY CAST(number AS INTEGER)");
        console.log(`Tables now with AreaId=1: ${fixed.length}`);
        fixed.forEach(t => console.log(`  Mesa ${t.number} (id: ${t.id})`));

        // Check accounts
        const [accounts] = await sequelize.query("SELECT COUNT(*) as cnt FROM Accounts");
        console.log(`Total accounts in DB: ${accounts[0].cnt}`);

        console.log('\nDone! Restart the server now.');
        process.exit(0);
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
})();
