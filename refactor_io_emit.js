const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const files = [
    'server/routes/operation.routes.js',
    'server/routes/account.routes.js',
    'server/routes/layout.routes.js',
    'server/routes/roulette.routes.js'
];

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let code = fs.readFileSync(file, 'utf-8');
    const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
    });

    let changed = false;

    traverse(ast, {
        CallExpression(path) {
            // Check for io.emit
            if (
                path.node.callee.type === 'MemberExpression' &&
                path.node.callee.property.name === 'emit' &&
                path.node.callee.object.type === 'Identifier' &&
                path.node.callee.object.name === 'io'
            ) {
                // Change io.emit(...) to io.to('tenant_' + req.tenant.id).emit(...)
                
                // Build `io.to('tenant_' + req.tenant.id)`
                const toCall = t.callExpression(
                    t.memberExpression(t.identifier('io'), t.identifier('to')),
                    [
                        t.binaryExpression(
                            '+',
                            t.stringLiteral('tenant_'),
                            t.memberExpression(
                                t.memberExpression(t.identifier('req'), t.identifier('tenant')),
                                t.identifier('id')
                            )
                        )
                    ]
                );

                path.node.callee.object = toCall;
                changed = true;
            }
        }
    });

    if (changed) {
        const output = generate(ast, { retainLines: false }, code);
        fs.writeFileSync(file, output.code, 'utf-8');
        console.log(`Updated io.emit in ${file}`);
    }
});
