const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, 'uploads');
console.log('--- STARTING UPLOADS FS MIGRATION ---');
console.log('Uploads root directory:', uploadsDir);

let movedFolders = 0;
let movedFiles = 0;

// 1. Move cuenta_* directories under 2026/{MM} into 2026/{MM}/tenant_1/cuenta_*
const years = ['2026'];
years.forEach(year => {
  const yearDir = path.join(uploadsDir, year);
  if (!fs.existsSync(yearDir)) return;

  const months = fs.readdirSync(yearDir);
  months.forEach(month => {
    const monthDir = path.join(yearDir, month);
    if (!fs.statSync(monthDir).isDirectory()) return;

    const tenantDir = path.join(monthDir, 'tenant_1');
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }

    const items = fs.readdirSync(monthDir);
    items.forEach(item => {
      if (item === 'tenant_1') return;
      if (item.startsWith('cuenta_')) {
        const srcPath = path.join(monthDir, item);
        const destPath = path.join(tenantDir, item);

        if (!fs.existsSync(destPath)) {
          fs.renameSync(srcPath, destPath);
          movedFolders++;
        } else {
          // If dest folder already exists, move any files inside
          const files = fs.readdirSync(srcPath);
          files.forEach(f => {
            const srcFile = path.join(srcPath, f);
            const destFile = path.join(destPath, f);
            if (!fs.existsSync(destFile)) {
              fs.renameSync(srcFile, destFile);
              movedFiles++;
            }
          });
          try { fs.rmdirSync(srcPath); } catch (_) {}
        }
      }
    });
  });
});

console.log(`Moved ${movedFolders} cuenta_* folders to tenant_1.`);

// 2. Move account_* directories under uploads/ to uploads/2026/06/tenant_1/cuenta_*
const rootItems = fs.readdirSync(uploadsDir);
let movedLegacyAccounts = 0;
rootItems.forEach(item => {
  if (item.startsWith('account_')) {
    const accountId = item.replace('account_', '');
    const srcPath = path.join(uploadsDir, item);
    if (!fs.statSync(srcPath).isDirectory()) return;

    // All account_* folders date from June 2026
    const destDir = path.join(uploadsDir, '2026', '06', 'tenant_1', `cuenta_${accountId}`);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const files = fs.readdirSync(srcPath);
    files.forEach(f => {
      const srcFile = path.join(srcPath, f);
      const destFile = path.join(destDir, f);
      if (!fs.existsSync(destFile)) {
        fs.renameSync(srcFile, destFile);
        movedFiles++;
      }
    });

    try {
      fs.rmdirSync(srcPath);
      movedLegacyAccounts++;
    } catch (e) {
      console.warn(`Could not remove ${srcPath}:`, e.message);
    }
  }
});

console.log(`Moved ${movedLegacyAccounts} legacy account_* folders.`);
console.log(`Total individual files relocated: ${movedFiles}`);
console.log('--- COMPLETED UPLOADS FS MIGRATION ---');
process.exit(0);
