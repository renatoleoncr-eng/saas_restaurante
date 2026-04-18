const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'server/stock_debug_test.log');
console.log("Writing to:", logFile);
fs.writeFileSync(logFile, `Test log at ${new Date().toISOString()}\n`);
console.log("Done.");
