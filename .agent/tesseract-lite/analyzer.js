const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../../');
const dirsToScan = ['client', 'server'];
const outputDir = __dirname;
const outputFile = path.join(outputDir, 'data.json');

const nodes = [];
const links = [];
const nodeMap = new Map();

function getRelativePath(absolutePath) {
    return path.relative(projectRoot, absolutePath).replace(/\\/g, '/');
}

function scanDir(dirPath) {
    const fullPath = path.join(projectRoot, dirPath);
    if (!fs.existsSync(fullPath)) return;

    const files = fs.readdirSync(fullPath);

    files.forEach(file => {
        const filePath = path.join(fullPath, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            if (file === 'node_modules' || file === '.git' || file === '.agent') return;
            scanDir(path.join(dirPath, file));
        } else if (file.match(/\.(js|jsx|ts|tsx|vue|html|css|php)$/)) {
            const relPath = getRelativePath(filePath);
            const node = {
                id: relPath,
                name: file,
                group: dirPath.split('/')[0],
                type: path.extname(file).slice(1)
            };
            nodes.push(node);
            nodeMap.set(relPath, node);
        }
    });
}

function extractDependencies() {
    nodes.forEach(node => {
        const filePath = path.join(projectRoot, node.id);
        const content = fs.readFileSync(filePath, 'utf8');

        // Regex for imports
        const importRegex = /(?:import|from|require|import)\s*\(?['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            let target = match[1];
            
            // Handle relative imports
            if (target.startsWith('.')) {
                const absoluteTarget = path.resolve(path.dirname(filePath), target);
                
                // Try different extensions if not specified
                const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js'];
                let resolvedPath = null;
                for (let ext of extensions) {
                    const p = absoluteTarget + ext;
                    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
                        resolvedPath = getRelativePath(p);
                        break;
                    }
                }

                if (resolvedPath && nodeMap.has(resolvedPath)) {
                    links.push({
                        source: node.id,
                        target: resolvedPath
                    });
                }
            }
        }
    });
}

console.log('Scanning directories...');
dirsToScan.forEach(scanDir);
console.log(`Found ${nodes.length} nodes. Extracting dependencies...`);
extractDependencies();
console.log(`Found ${links.length} links.`);

const data = { nodes, links };
fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
console.log(`Graph data saved to ${outputFile}`);
