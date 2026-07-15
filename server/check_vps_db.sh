#!/bin/bash
docker exec -i restaurante-prod node -e "
const { CashSession, AuditLog } = require('./models');
async function run() {
  try {
    // Delete session 104
    await CashSession.destroy({ where: { id: 104 } });
    await AuditLog.destroy({ where: { entityId: '104', entity: 'CashSession' } });
    console.log('Session 104 and its logs deleted.');
  } catch (err) {
    console.error(err);
  }
}
run();
"
