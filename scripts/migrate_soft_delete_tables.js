const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('gestion_restaurante', 'restaurante_user', 'restaurante_password', {
  host: 'db',
  dialect: 'mysql',
  logging: false
});

console.log('--- STARTING TABLE SOFT-DELETE MIGRATION & RESTORATION ---');

async function run() {
  // 1. Add deletedAt to Tables table if not present
  const [cols] = await sequelize.query("SHOW COLUMNS FROM Tables LIKE 'deletedAt'");
  if (cols.length === 0) {
    console.log("Adding column 'deletedAt' to Tables...");
    await sequelize.query("ALTER TABLE Tables ADD COLUMN deletedAt DATETIME NULL DEFAULT NULL");
    console.log("Column 'deletedAt' added successfully.");
  } else {
    console.log("Column 'deletedAt' already exists on Tables.");
  }

  // 2. Check if Table 7 already exists, if not restore it with deletedAt
  const [existingTable7] = await sequelize.query("SELECT id, number, AreaId, deletedAt FROM Tables WHERE id = 7");
  if (existingTable7.length === 0) {
    console.log("Restoring historical Table 7 (Mesa A7) with soft-deleted state...");
    await sequelize.query(`
      INSERT INTO Tables (id, number, AreaId, status, x, y, TenantId, deletedAt, createdAt, updatedAt)
      VALUES (7, '7', 2, 'free', 0, 0, 1, '2026-10-02 01:46:00', '2026-03-02 21:10:20', '2026-10-02 01:46:00')
    `);
    console.log("Table 7 restored successfully with deletedAt = '2026-10-02 01:46:00'.");
  } else {
    console.log("Table 7 already exists:", existingTable7[0]);
    if (!existingTable7[0].deletedAt) {
      await sequelize.query("UPDATE Tables SET deletedAt = '2026-10-02 01:46:00' WHERE id = 7");
      console.log("Marked Table 7 as soft-deleted.");
    }
  }

  // 3. Find orphaned accounts from AuditLogs
  const nullAccounts = await sequelize.query(
    "SELECT id FROM Accounts WHERE TableId IS NULL",
    { type: Sequelize.QueryTypes.SELECT }
  );
  console.log(`Auditing ${nullAccounts.length} accounts with TableId IS NULL...`);

  const accountsToRestore = [];
  for (const acc of nullAccounts) {
    const logs = await sequelize.query(
      "SELECT details FROM AuditLogs WHERE (entityId = ? AND entity = 'Account' AND action = 'OPEN_ACCOUNT') LIMIT 1",
      { replacements: [acc.id], type: Sequelize.QueryTypes.SELECT }
    );
    if (logs.length > 0) {
      try {
        const d = JSON.parse(logs[0].details);
        if (d.tableId === 7) {
          accountsToRestore.push(acc.id);
        }
      } catch (_) {}
    }
  }

  console.log(`Found ${accountsToRestore.length} accounts originally from Table 7.`);
  if (accountsToRestore.length > 0) {
    await sequelize.query(
      "UPDATE Accounts SET TableId = 7 WHERE id IN (?)",
      { replacements: [accountsToRestore] }
    );
    console.log(`Successfully reconnected ${accountsToRestore.length} accounts to Table 7.`);
  }

  // 4. Verify
  const [verifyTable] = await sequelize.query("SELECT id, number, AreaId, deletedAt FROM Tables WHERE id = 7");
  console.log('Verification Table 7:', verifyTable[0]);

  const [verifyAccounts] = await sequelize.query("SELECT count(*) as count FROM Accounts WHERE TableId = 7");
  console.log('Verification Accounts for Table 7:', verifyAccounts[0]);

  console.log('--- COMPLETED TABLE SOFT-DELETE MIGRATION & RESTORATION ---');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
