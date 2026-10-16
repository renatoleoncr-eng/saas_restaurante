const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

const sequelize = new Sequelize('gestion_restaurante', 'restaurante_user', 'restaurante_password', {
  host: 'db',
  dialect: 'mysql',
  logging: false
});

const uploadsRoot = path.join(__dirname, 'uploads');
console.log('--- STARTING UPLOADS DB NORMALIZATION & AUDIT ---');

async function run() {
  // 1. Process Payments
  const payments = await sequelize.query(
    "SELECT id, evidence, TenantId FROM Payments WHERE evidence IS NOT NULL AND evidence != '' AND evidence != '[]'",
    { type: Sequelize.QueryTypes.SELECT }
  );
  console.log(`Auditing ${payments.length} payment records...`);

  let updatedPayments = 0;
  let missingPaymentFiles = 0;

  for (const p of payments) {
    try {
      let paths = JSON.parse(p.evidence);
      if (!Array.isArray(paths)) paths = [paths];

      let changed = false;
      const normalizedPaths = paths.map(rawUrl => {
        if (typeof rawUrl !== 'string') return rawUrl;
        let url = rawUrl.trim();

        // Convert legacy /uploads/account_123/file.jpg -> /uploads/2026/06/tenant_1/cuenta_123/file.jpg
        if (url.includes('/uploads/account_')) {
          url = url.replace(/\/uploads\/account_(\d+)\//, '/uploads/2026/06/tenant_1/cuenta_$1/');
          changed = true;
        }

        // Convert /uploads/YYYY/MM/cuenta_123/file.jpg -> /uploads/YYYY/MM/tenant_1/cuenta_123/file.jpg
        if (/\/uploads\/\d{4}\/\d{2}\/cuenta_/.test(url)) {
          const tenantId = p.TenantId || 1;
          url = url.replace(/\/uploads\/(\d{4})\/(\d{2})\/(cuenta_\d+)\//, `/uploads/$1/$2/tenant_${tenantId}/$3/`);
          changed = true;
        }

        // Ensure leading slash
        if (!url.startsWith('/')) {
          url = '/' + url;
          changed = true;
        }

        // Verify existence on disk
        const relOnDisk = url.startsWith('/') ? url.substring(1) : url;
        const fullPath = path.join(__dirname, relOnDisk);
        if (!fs.existsSync(fullPath)) {
          console.warn(`[WARN] Missing file on disk for payment ${p.id}: ${fullPath}`);
          missingPaymentFiles++;
        }

        return url;
      });

      if (changed) {
        await sequelize.query('UPDATE Payments SET evidence = ? WHERE id = ?', {
          replacements: [JSON.stringify(normalizedPaths), p.id]
        });
        updatedPayments++;
      }
    } catch (err) {
      console.error(`Error processing payment ${p.id}:`, err.message);
    }
  }

  console.log(`Payments updated: ${updatedPayments}. Missing files: ${missingPaymentFiles}.`);

  // 2. Process Accounts
  const accounts = await sequelize.query(
    "SELECT id, paymentEvidence, TenantId FROM Accounts WHERE paymentEvidence IS NOT NULL AND paymentEvidence != '' AND paymentEvidence != '[]'",
    { type: Sequelize.QueryTypes.SELECT }
  );
  console.log(`Auditing ${accounts.length} account records...`);

  let updatedAccounts = 0;
  let missingAccountFiles = 0;

  for (const a of accounts) {
    try {
      let paths = JSON.parse(a.paymentEvidence);
      if (!Array.isArray(paths)) paths = [paths];

      let changed = false;
      const normalizedPaths = paths.map(rawUrl => {
        if (typeof rawUrl !== 'string') return rawUrl;
        let url = rawUrl.trim();

        if (url.includes('/uploads/account_')) {
          url = url.replace(/\/uploads\/account_(\d+)\//, '/uploads/2026/06/tenant_1/cuenta_$1/');
          changed = true;
        }

        if (/\/uploads\/\d{4}\/\d{2}\/cuenta_/.test(url)) {
          const tenantId = a.TenantId || 1;
          url = url.replace(/\/uploads\/(\d{4})\/(\d{2})\/(cuenta_\d+)\//, `/uploads/$1/$2/tenant_${tenantId}/$3/`);
          changed = true;
        }

        if (!url.startsWith('/')) {
          url = '/' + url;
          changed = true;
        }

        const relOnDisk = url.startsWith('/') ? url.substring(1) : url;
        const fullPath = path.join(__dirname, relOnDisk);
        if (!fs.existsSync(fullPath)) {
          console.warn(`[WARN] Missing file on disk for account ${a.id}: ${fullPath}`);
          missingAccountFiles++;
        }

        return url;
      });

      if (changed) {
        await sequelize.query('UPDATE Accounts SET paymentEvidence = ? WHERE id = ?', {
          replacements: [JSON.stringify(normalizedPaths), a.id]
        });
        updatedAccounts++;
      }
    } catch (err) {
      console.error(`Error processing account ${a.id}:`, err.message);
    }
  }

  console.log(`Accounts updated: ${updatedAccounts}. Missing files: ${missingAccountFiles}.`);
  console.log('--- COMPLETED UPLOADS DB NORMALIZATION & AUDIT ---');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal DB error:', err);
  process.exit(1);
});
