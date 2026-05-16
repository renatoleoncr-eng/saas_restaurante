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

// Generate self-contained viewer.html with data inlined
const viewerPath = path.join(outputDir, 'viewer.html');

const typeColors = {
    js: '#f59e0b', jsx: '#3b82f6', ts: '#06b6d4', tsx: '#60a5fa',
    vue: '#10b981', html: '#ef4444', css: '#a855f7', php: '#8b5cf6'
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tesseract Lite — Gestion Restaurante</title>
    <script src="https://unpkg.com/3d-force-graph@1.73.3/dist/3d-force-graph.min.js"><\/script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080c14; color: #e2e8f0; font-family: 'Segoe UI', sans-serif; overflow: hidden; }
        #panel {
            position: absolute; top: 20px; left: 20px;
            background: rgba(15, 23, 42, 0.92);
            border: 1px solid #1e3a5f;
            border-radius: 12px;
            padding: 20px;
            width: 260px;
            z-index: 10;
            backdrop-filter: blur(12px);
            box-shadow: 0 0 30px rgba(59,130,246,0.15);
        }
        .logo { font-size: 20px; font-weight: 700; letter-spacing: 2px; color: #60a5fa; margin-bottom: 4px; }
        .subtitle { font-size: 12px; color: #64748b; margin-bottom: 16px; }
        .stats { display: flex; gap: 12px; margin-bottom: 16px; }
        .stat { background: rgba(30,58,95,0.5); border-radius: 8px; padding: 8px 12px; flex: 1; text-align: center; }
        .stat-num { font-size: 20px; font-weight: 700; color: #60a5fa; }
        .stat-label { font-size: 10px; color: #64748b; text-transform: uppercase; }
        .legend { display: flex; flex-direction: column; gap: 5px; margin-bottom: 16px; }
        .legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #94a3b8; }
        .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .controls { font-size: 11px; color: #475569; line-height: 1.8; border-top: 1px solid #1e3a5f; padding-top: 12px; }
        #node-info { display: none; border-top: 1px solid #1e3a5f; margin-top: 16px; padding-top: 16px; }
        .info-row { margin-bottom: 8px; }
        .info-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
        .info-val { font-size: 13px; color: #e2e8f0; word-break: break-all; }
        #graph { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
    </style>
</head>
<body>
<div id="panel">
    <div class="logo">⬡ TESSERACT LITE</div>
    <div class="subtitle">Gestion Restaurante — Architecture Map</div>
    <div class="stats">
        <div class="stat"><div class="stat-num">${nodes.length}</div><div class="stat-label">Files</div></div>
        <div class="stat"><div class="stat-num">${links.length}</div><div class="stat-label">Links</div></div>
    </div>
    <div class="legend">
        <div class="legend-item"><div class="dot" style="background:#3b82f6"></div>client/</div>
        <div class="legend-item"><div class="dot" style="background:#ef4444"></div>server/</div>
        <div class="legend-item"><div class="dot" style="background:#6366f1"></div>other</div>
    </div>
    <div class="controls">
        🖱 Drag — Rotar<br>
        🔍 Scroll — Zoom<br>
        👆 Click — Seleccionar nodo
    </div>
    <div id="node-info">
        <div class="info-row"><div class="info-label">Archivo</div><div class="info-val" id="ni-name">-</div></div>
        <div class="info-row"><div class="info-label">Ruta</div><div class="info-val" id="ni-path">-</div></div>
        <div class="info-row"><div class="info-label">Tipo</div><div class="info-val" id="ni-type">-</div></div>
    </div>
</div>
<div id="graph"></div>
<script>
const graphData = ${JSON.stringify(data)};

const groupColors = { client: '#3b82f6', server: '#ef4444' };
const typeColors = ${JSON.stringify(typeColors)};

const Graph = ForceGraph3D()(document.getElementById('graph'))
    .graphData(graphData)
    .backgroundColor('#080c14')
    .nodeLabel(n => \`<div style="background:#0f172a;color:#e2e8f0;padding:5px 10px;border-radius:6px;border:1px solid #1e3a5f;font-size:12px;">\${n.id}</div>\`)
    .nodeColor(n => groupColors[n.group] || '#6366f1')
    .nodeRelSize(5)
    .nodeOpacity(0.9)
    .linkColor(() => '#1e3a5f')
    .linkWidth(0.8)
    .linkDirectionalParticles(3)
    .linkDirectionalParticleWidth(1.2)
    .linkDirectionalParticleSpeed(0.004)
    .linkDirectionalParticleColor(() => '#60a5fa')
    .onNodeClick(node => {
        const dist = 120;
        const distRatio = 1 + dist / Math.hypot(node.x, node.y, node.z);
        Graph.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
            node, 1500
        );
        document.getElementById('node-info').style.display = 'block';
        document.getElementById('ni-name').textContent = node.name;
        document.getElementById('ni-path').textContent = node.id;
        document.getElementById('ni-type').textContent = node.type.toUpperCase();
    })
    .onBackgroundClick(() => {
        document.getElementById('node-info').style.display = 'none';
    });
<\/script>
</body>
</html>`;

fs.writeFileSync(viewerPath, html);
console.log(`Self-contained viewer saved to ${viewerPath}`);
