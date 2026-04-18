// Clean up duplicate/old tables: keep only the MOST RECENTLY USED table for each number (1-5)
// then remove all other duplicates.
const { sequelize } = require('./models');

(async () => {
    try {
        // Find the tables with actual account activity, grouped by number
        const [tableActivity] = await sequelize.query(`
            SELECT t.id, t.number, t.status, COUNT(a.id) as accountCount, MAX(a.createdAt) as lastActivity
            FROM Tables t
            LEFT JOIN Accounts a ON a.TableId = t.id
            WHERE t.AreaId = 1 AND t.number NOT IN ('FlowT','RepT')
            GROUP BY t.id
            ORDER BY t.number ASC, COUNT(a.id) DESC, t.id DESC
        `);

        console.log('\n=== Current Tables with Activity ===');
        const toKeep = new Map(); // number -> id of best table to keep

        for (const t of tableActivity) {
            const num = t.number;
            if (!toKeep.has(num)) {
                toKeep.set(num, t.id); // Keep first (most activity or highest id)
                console.log(`KEEP: Mesa ${num} (id: ${t.id}) - ${t.accountCount} accounts, status: ${t.status}`);
            } else {
                console.log(`REMOVE: Mesa ${num} (id: ${t.id}) - duplicate, ${t.accountCount} accounts`);
            }
        }

        const keepIds = [...toKeep.values()];
        console.log(`\nKeeping ${keepIds.length} tables: IDs ${keepIds.join(', ')}`);

        const toRemoveRows = tableActivity.filter(t => !keepIds.includes(t.id));
        const removeIds = toRemoveRows.map(t => t.id);
        console.log(`Removing ${removeIds.length} duplicate/old tables`);

        if (removeIds.length > 0) {
            // First: detach accounts from removed tables by setting TableId to the preferred table
            for (const removed of toRemoveRows) {
                const preferred = toKeep.get(removed.number);
                if (preferred && removed.accountCount > 0) {
                    // The accounts for this duplicate table - we'll just log this as the user may want to review
                    console.log(`  Note: Mesa ${removed.number} (id:${removed.id}) had ${removed.accountCount} accounts - they'll be reassigned to Mesa ${removed.number} id:${preferred}`);
                    await sequelize.query(`UPDATE Accounts SET TableId=${preferred} WHERE TableId=${removed.id}`);
                }
            }

            // Now delete the duplicate tables
            await sequelize.query(`DELETE FROM Tables WHERE id IN (${removeIds.join(',')})`);
            console.log(`Deleted ${removeIds.length} tables.`);
        }

        const [remaining] = await sequelize.query(`SELECT id, number, status FROM Tables WHERE AreaId=1 ORDER BY CAST(number AS INTEGER)`);
        console.log(`\n=== Remaining tables after cleanup (${remaining.length}) ===`);
        remaining.forEach(t => console.log(`  Mesa ${t.number} (id: ${t.id}) - ${t.status}`));

        process.exit(0);
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
})();
