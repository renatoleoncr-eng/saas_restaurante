const fs = require('fs');
const path = require('path');

async function run() {
    const promoPath = path.join(__dirname, 'routes', 'promotion.routes.js');
    if (fs.existsSync(promoPath)) {
        let content = fs.readFileSync(promoPath, 'utf8');
        content = content.replace(
            /groupId: groupId \|\| null,\n                isActive: true\n            }\);/g,
            'groupId: groupId || null,\n                isActive: true,\n                TenantId: req.tenant.id\n            });'
        );
        fs.writeFileSync(promoPath, content);
        console.log("Patched promotion.routes.js");
    }

    const qrPath = path.join(__dirname, 'routes', 'qr.routes.js');
    if (fs.existsSync(qrPath)) {
        let content = fs.readFileSync(qrPath, 'utf8');
        content = content.replace(
            /phoneNumber: phoneNumber \|\| null,\n            imageUrl\n        }\);/g,
            'phoneNumber: phoneNumber || null,\n            imageUrl,\n            TenantId: req.tenant.id\n        });'
        );
        content = content.replace(
            /description: description \|\| `Ajuste manual de saldo - \$\{qr\.name\}`\n                }\),/g,
            'description: description || `Ajuste manual de saldo - ${qr.name}`\n                }),\n                TenantId: req.tenant.id,'
        );
        fs.writeFileSync(qrPath, content);
        console.log("Patched qr.routes.js");
    }
}
run();
