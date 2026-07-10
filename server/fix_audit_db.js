const fs = require('fs');

async function run() {
    const { sequelize } = require('./models');
    try {
        await sequelize.query(`
            UPDATE AuditLogs
            SET TenantId = 1
            WHERE TenantId IS NULL;
        `);
        console.log("AuditLogs TenantId fixed.");
    } catch(e) {
        console.error("DB fix error:", e);
    }
}
run();
