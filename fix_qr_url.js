const fs = require('fs');

const file = 'server/routes/qr.routes.js';
let code = fs.readFileSync(file, 'utf-8');

code = code.replace(
    /if \(req\.file\) \{\s*imageUrl = `\/uploads\/\$\{req\.file\.filename\}`;?\s*\}/g,
    `if (req.file) {
        const tenantId = req.tenant ? req.tenant.id : 'global';
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        imageUrl = \`/uploads/qrs/\${year}/\${month}/tenant_\${tenantId}/\${req.file.filename}\`;
    }`
);

code = code.replace(
    /qr\.imageUrl = `\/uploads\/\$\{req\.file\.filename\}`;?\s*\}/g,
    `const tenantId = req.tenant ? req.tenant.id : 'global';
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        qr.imageUrl = \`/uploads/qrs/\${year}/\${month}/tenant_\${tenantId}/\${req.file.filename}\`;
    }`
);

fs.writeFileSync(file, code, 'utf-8');
console.log('Fixed qr imageUrl');
