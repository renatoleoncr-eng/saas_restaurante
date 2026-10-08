const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const files = [
    'server/routes/operation.routes.js',
    'server/routes/billing.routes.js',
    'server/routes/product.routes.js',
    'server/routes/superadmin.routes.js' // Will exclude Tenant in code
];

files.forEach(file => {
    let code = fs.readFileSync(file, 'utf-8');
    const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
    });

    let changed = false;

    traverse(ast, {
        CallExpression(path) {
            // Check for Model.findByPk
            if (
                path.node.callee.type === 'MemberExpression' &&
                path.node.callee.property.name === 'findByPk' &&
                path.node.callee.object.type === 'Identifier'
            ) {
                const modelName = path.node.callee.object.name;
                // Exclude Tenant because it doesn't have TenantId column
                if (modelName === 'Tenant' || modelName === 'RestaurantConfig') {
                    return;
                }

                const args = path.node.arguments;
                if (args.length >= 1) {
                    const idArg = args[0];
                    let optionsArg = args[1] || t.objectExpression([]);

                    // We need to inject where: { id: idArg, TenantId: req.tenant.id } into optionsArg
                    // If optionsArg is an ObjectExpression, we can just find or add 'where'
                    if (optionsArg.type === 'ObjectExpression') {
                        let whereProp = optionsArg.properties.find(p => p.key && p.key.name === 'where');
                        if (!whereProp) {
                            whereProp = t.objectProperty(t.identifier('where'), t.objectExpression([]));
                            optionsArg.properties.push(whereProp);
                        }
                        
                        if (whereProp.value.type === 'ObjectExpression') {
                            // Add id: idArg
                            whereProp.value.properties.push(
                                t.objectProperty(t.identifier('id'), idArg)
                            );
                            // Add TenantId: req.tenant.id
                            whereProp.value.properties.push(
                                t.objectProperty(
                                    t.identifier('TenantId'),
                                    t.memberExpression(t.memberExpression(t.identifier('req'), t.identifier('tenant')), t.identifier('id'))
                                )
                            );
                        }
                    } else {
                        // Options is a variable or something else, wrap it with Object.assign?
                        // Let's assume it's mostly ObjectExpressions inline.
                        console.log(`Complex options in ${file} for ${modelName}`);
                    }

                    // Change callee to findOne
                    path.node.callee.property.name = 'findOne';
                    
                    // Replace arguments: just the optionsArg
                    path.node.arguments = [optionsArg];
                    
                    changed = true;
                }
            }
            
            // Fix destroy({ where: { AccountId: id } }) -> destroy({ where: { AccountId: id, TenantId: req.tenant.id } })
            if (
                path.node.callee.type === 'MemberExpression' &&
                path.node.callee.property.name === 'destroy' &&
                path.node.callee.object.type === 'Identifier'
            ) {
                const args = path.node.arguments;
                if (args.length === 1 && args[0].type === 'ObjectExpression') {
                    let optionsArg = args[0];
                    let whereProp = optionsArg.properties.find(p => p.key && p.key.name === 'where');
                    if (whereProp && whereProp.value.type === 'ObjectExpression') {
                        // Add TenantId filter
                        whereProp.value.properties.push(
                                t.objectProperty(
                                    t.identifier('TenantId'),
                                    t.memberExpression(t.memberExpression(t.identifier('req'), t.identifier('tenant')), t.identifier('id'))
                                )
                        );
                        changed = true;
                    }
                }
            }
        }
    });

    if (changed) {
        const output = generate(ast, { retainLines: false }, code);
        fs.writeFileSync(file, output.code, 'utf-8');
        console.log(`Updated ${file}`);
    }
});
