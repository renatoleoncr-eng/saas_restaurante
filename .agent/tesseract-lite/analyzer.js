const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../../');
const outputDir = __dirname;
const outputFile = path.join(outputDir, 'data.json');

const nodes = [];
const links = [];
const nodeMap = new Map();
const parsedModelNames = [];

function getRelativePath(absolutePath) {
    return path.relative(projectRoot, absolutePath).replace(/\\/g, '/');
}

// 1. Add Master SQLite Database node
const dbNodeId = 'database.sqlite';
nodes.push({
    id: dbNodeId,
    name: 'database.sqlite (SQLite BBDD)',
    group: 'database',
    type: 'db',
    size: 25
});
nodeMap.set(dbNodeId, true);

// 2. Parse Sequelize Models & Associations from server/models/index.js
const modelsFilePath = path.join(projectRoot, 'server/models/index.js');
if (fs.existsSync(modelsFilePath)) {
    console.log('Extracting BBDD Models and Relationships...');
    const content = fs.readFileSync(modelsFilePath, 'utf8');
    
    // Parse model definitions: const Table = sequelize.define('Table', ...
    const modelDefineRegex = /const\s+(\w+)\s*=\s*sequelize\.define\(\s*['"](\w+)['"]/g;
    let match;
    while ((match = modelDefineRegex.exec(content)) !== null) {
        const modelName = match[1];
        const modelId = `model:${modelName}`;
        
        parsedModelNames.push(modelName);
        
        nodes.push({
            id: modelId,
            name: `${modelName} (Sequelize Model)`,
            group: 'db_model',
            type: 'model',
            size: 14
        });
        nodeMap.set(modelId, true);
        
        // Link all Table Models to the SQLite database node
        links.push({
            source: modelId,
            target: dbNodeId,
            type: 'db_connection'
        });
    }
    console.log(`Parsed ${parsedModelNames.length} Database Table Models!`);

    // Parse model associations: e.g. Area.hasMany(Table);
    const associationRegex = /(\w+)\.(hasMany|belongsTo|hasOne|belongsToMany)\((\w+)/g;
    let assocCount = 0;
    while ((match = associationRegex.exec(content)) !== null) {
        const source = match[1];
        const assocType = match[2];
        const target = match[3];
        
        const sourceId = `model:${source}`;
        const targetId = `model:${target}`;
        
        if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
            links.push({
                source: sourceId,
                target: targetId,
                type: 'association',
                label: assocType
            });
            assocCount++;
        }
    }
    console.log(`Mapped ${assocCount} database table relationships!`);
}

// 3. Scan codebase directories for actual architectural components (Excluding utility scripts)
const pathsToScan = [
    'server/index.js',
    'server/config',
    'server/routes',
    'server/utils',
    'client/src'
];

function scanPath(subPath) {
    const fullPath = path.join(projectRoot, subPath);
    if (!fs.existsSync(fullPath)) return;

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
        const files = fs.readdirSync(fullPath);
        files.forEach(file => {
            scanPath(path.join(subPath, file));
        });
    } else if (stats.isFile() && subPath.match(/\.(js|jsx|ts|tsx|vue|html|css|php)$/)) {
        const relPath = getRelativePath(fullPath);
        
        // Exclude generic debug, test, or scratch files
        const lowercaseFile = path.basename(relPath).toLowerCase();
        if (
            lowercaseFile.startsWith('check_') || 
            lowercaseFile.startsWith('test_') || 
            lowercaseFile.startsWith('debug_') || 
            lowercaseFile.startsWith('temp_') ||
            lowercaseFile.includes('.test.') ||
            lowercaseFile.includes('.spec.')
        ) {
            return;
        }

        // Determine Architectural Group
        let group = 'other';
        let size = 6;
        if (relPath.startsWith('server/routes')) {
            group = 'api_route';
            size = 9;
        } else if (relPath.startsWith('server/config')) {
            group = 'server_core';
            size = 8;
        } else if (relPath === 'server/index.js') {
            group = 'server_core';
            size = 12;
        } else if (relPath.startsWith('client/src/views')) {
            group = 'fe_view';
            size = 9;
        } else if (relPath.startsWith('client/src/components')) {
            group = 'fe_component';
            size = 7;
        } else if (relPath.startsWith('client/src/contexts') || relPath === 'client/src/App.jsx' || relPath === 'client/src/main.jsx') {
            group = 'fe_core';
            size = 9;
        } else if (relPath.includes('utils')) {
            group = 'shared_util';
            size = 6;
        }

        nodes.push({
            id: relPath,
            name: path.basename(relPath),
            group: group,
            type: path.extname(relPath).slice(1),
            size: size
        });
        nodeMap.set(relPath, true);
    }
}

console.log('Scanning architectural layers...');
pathsToScan.forEach(scanPath);
console.log(`Found ${nodes.length} architectural nodes.`);

// 4. Trace dependencies and data flows
const apiPrefixMap = {
    accounts: 'server/routes/account.routes.js',
    attendance: 'server/routes/attendance.routes.js',
    audit: 'server/routes/audit.routes.js',
    auth: 'server/routes/auth.routes.js',
    billing: 'server/routes/billing.routes.js',
    config: 'server/routes/config.routes.js',
    'drink-promotions': 'server/routes/drink-promotions.routes.js',
    expenses: 'server/routes/expense.routes.js',
    layout: 'server/routes/layout.routes.js',
    menu: 'server/routes/menu.routes.js',
    operations: 'server/routes/operation.routes.js',
    products: 'server/routes/product.routes.js',
    recipes: 'server/routes/recipe.routes.js',
    reservations: 'server/routes/reservation.routes.js',
    revenue: 'server/routes/revenue.routes.js',
    sessions: 'server/routes/session.routes.js',
    users: 'server/routes/user.routes.js'
};

nodes.forEach(node => {
    // If it's a Sequelize model node, we already mapped its link
    if (node.id.startsWith('model:') || node.id === dbNodeId) return;

    const filePath = path.join(projectRoot, node.id);
    const content = fs.readFileSync(filePath, 'utf8');

    // Link Backend Routes to Database Table Models they query
    if (node.group === 'api_route') {
        parsedModelNames.forEach(modelName => {
            const modelRegex = new RegExp(`\\b${modelName}\\b`, 'g');
            if (modelRegex.test(content)) {
                links.push({
                    source: node.id,
                    target: `model:${modelName}`,
                    type: 'db_query'
                });
            }
        });
    }

    // Link Frontend Views/Components to API Routes via endpoint prefixes (Data Flow)
    if (node.id.startsWith('client/src')) {
        const apiRegex = /\/api\/([a-zA-Z0-9_-]+)/g;
        let apiMatch;
        const linkedRoutes = new Set();
        while ((apiMatch = apiRegex.exec(content)) !== null) {
            const prefix = apiMatch[1];
            const routeFile = apiPrefixMap[prefix];
            if (routeFile && !linkedRoutes.has(routeFile)) {
                links.push({
                    source: node.id,
                    target: routeFile,
                    type: 'api_call'
                });
                linkedRoutes.add(routeFile);
            }
        }
    }

    // Standard relative import tracing for file connections (JSX imports, requires, etc.)
    const importRegex = /(?:import|from|require|import)\s*\(?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        let target = match[1];
        
        if (target.startsWith('.')) {
            const absoluteTarget = path.resolve(path.dirname(filePath), target);
            const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js'];
            let resolvedPath = null;
            for (let ext of extensions) {
                const p = absoluteTarget + ext;
                if (fs.existsSync(p) && fs.statSync(p).isFile()) {
                    resolvedPath = getRelativePath(p);
                    break;
                }
            }

            if (resolvedPath && nodeMap.has(resolvedPath) && resolvedPath !== node.id) {
                links.push({
                    source: node.id,
                    target: resolvedPath,
                    type: 'dependency'
                });
            }
        }
    }
});

console.log(`Successfully mapped ${links.length} visual links!`);

// Write self-contained viewer.html
const viewerPath = path.join(outputDir, 'viewer.html');
const data = { nodes, links };
fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tesseract Lite — Premium 3D Architecture Map</title>
    <script src="https://unpkg.com/three@0.146.0/build/three.min.js"><\/script>
    <script src="https://unpkg.com/3d-force-graph@1.73.3/dist/3d-force-graph.min.js"><\/script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07090e; color: #f1f5f9; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; overflow: hidden; }
        
        #panel {
            position: absolute; top: 20px; left: 20px;
            background: rgba(10, 15, 30, 0.94);
            border: 1px solid rgba(59, 130, 246, 0.25);
            border-radius: 16px;
            padding: 24px;
            width: 320px;
            z-index: 10;
            backdrop-filter: blur(20px);
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(59, 130, 246, 0.1);
        }
        
        .logo-container { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .logo { font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #3b82f6; text-shadow: 0 0 15px rgba(59,130,246,0.5); }
        .subtitle { font-size: 11px; color: #64748b; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1.5px; }
        
        .stats { display: flex; gap: 10px; margin-bottom: 20px; }
        .stat { background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 10px; flex: 1; text-align: center; }
        .stat-num { font-size: 22px; font-weight: 800; color: #60a5fa; }
        .stat-label { font-size: 9px; color: #94a3b8; text-transform: uppercase; margin-top: 2px; }
        
        .legend-title { font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .legend { display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 16px; }
        .legend-item { display: flex; align-items: center; gap: 10px; font-size: 12px; color: #cbd5e1; }
        .dot { width: 12px; height: 12px; border-radius: 4px; flex-shrink: 0; box-shadow: 0 0 8px currentColor; }
        
        .controls { font-size: 11px; color: #64748b; line-height: 1.8; margin-bottom: 20px; }
        
        #node-info { display: none; border-top: 1px solid rgba(59, 130, 246, 0.2); margin-top: 20px; padding-top: 20px; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        
        .info-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .info-tag { font-size: 9px; font-weight: 700; color: #07090e; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }
        .info-row { margin-bottom: 12px; }
        .info-label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
        .info-val { font-size: 14px; color: #f8fafc; word-break: break-all; font-family: monospace; }
        
        #graph { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
    </style>
</head>
<body>
<div id="panel">
    <div class="logo-container">
        <span class="logo">⬡ TESSERACT</span>
    </div>
    <div class="subtitle">Gestion Restaurante — Full-Stack 3D Map</div>
    
    <div class="stats">
        <div class="stat"><div class="stat-num">${nodes.length}</div><div class="stat-label">Nodes</div></div>
        <div class="stat"><div class="stat-num">${links.length}</div><div class="stat-label">Data Paths</div></div>
    </div>
    
    <div class="legend-title">Arquitectura</div>
    <div class="legend">
        <div class="legend-item"><div class="dot" style="background:#d97706; color:#d97706"></div>BBDD (SQLite)</div>
        <div class="legend-item"><div class="dot" style="background:#10b981; color:#10b981"></div>Modelos de BBDD (Sequelize)</div>
        <div class="legend-item"><div class="dot" style="background:#f43f5e; color:#f43f5e"></div>API Routes (Backend)</div>
        <div class="legend-item"><div class="dot" style="background:#e11d48; color:#e11d48"></div>Server Core / Config</div>
        <div class="legend-item"><div class="dot" style="background:#0284c7; color:#0284c7"></div>Vistas (Frontend Pages)</div>
        <div class="legend-item"><div class="dot" style="background:#3b82f6; color:#3b82f6"></div>Componentes (Frontend UI)</div>
        <div class="legend-item"><div class="dot" style="background:#14b8a6; color:#14b8a6"></div>Frontend Core / Contexts</div>
        <div class="legend-item"><div class="dot" style="background:#8b5cf6; color:#8b5cf6"></div>Shared Helpers & Utils</div>
    </div>
    
    <div class="controls">
        🖱️ Arrastrar click Izq — Rotar en 3D<br>
        🖱️ Arrastrar click Der — Desplazar plano<br>
        🔍 Scroll Rueda — Acercar / Alejar<br>
        👆 Clic en Nodo — Aislar y detallar arquitectura
    </div>
    
    <div id="node-info">
        <div class="info-header">
            <span id="ni-tag" class="info-tag" style="background:#3b82f6">Component</span>
            <strong id="ni-name" style="font-size:16px;">-</strong>
        </div>
        <div class="info-row">
            <div class="info-label">Ubicación Arquitectónica / Ruta</div>
            <div class="info-val" id="ni-path">-</div>
        </div>
    </div>
</div>

<div id="graph"></div>

<script>
const graphData = ${JSON.stringify(data)};

const colorPalette = {
    database: '#d97706',
    db_model: '#10b981',
    api_route: '#f43f5e',
    server_core: '#e11d48',
    fe_view: '#0284c7',
    fe_component: '#3b82f6',
    fe_core: '#14b8a6',
    shared_util: '#8b5cf6',
    other: '#64748b'
};

const tagLabels = {
    database: 'Base de Datos (BBDD)',
    db_model: 'Modelo ORM (Tabla)',
    api_route: 'Ruta de API (Backend)',
    server_core: 'Servidor / Config',
    fe_view: 'Vista (Frontend Page)',
    fe_component: 'Componente UI',
    fe_core: 'App Core / Context',
    shared_util: 'Utilidades',
    other: 'Archivo'
};

// Lock Y-coordinates to build stacked 3D horizontal layers!
const yLayers = {
    database: -180,
    db_model: -100,
    api_route: -20,
    server_core: -20,
    fe_view: 60,
    fe_component: 140,
    fe_core: 140,
    shared_util: 60,
    other: 60
};

graphData.nodes.forEach(n => {
    n.fy = yLayers[n.group] !== undefined ? yLayers[n.group] : 0;
});

const Graph = ForceGraph3D()(document.getElementById('graph'))
    .graphData(graphData)
    .backgroundColor('#07090e')
    .nodeLabel(n => \`
        <div style="background:#0f172a; color:#f1f5f9; padding:8px 12px; border-radius:8px; border:1px solid rgba(59,130,246,0.3); font-size:12px; font-family:'Segoe UI'; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
            <strong style="color:\${colorPalette[n.group]}">\${tagLabels[n.group]}</strong><br/>
            <span style="opacity:0.8">\${n.id}</span>
        </div>
    \`)
    .nodeThreeObject(node => {
        // Create 3D shape group
        const group = new THREE.Group();
        
        let geometry;
        let material;
        const color = colorPalette[node.group] || '#94a3b8';
        
        if (node.group === 'database') {
            // Gold Cylinder for Database File
            geometry = new THREE.CylinderGeometry(16, 16, 20, 24);
            material = new THREE.MeshPhongMaterial({
                color: color,
                emissive: '#78350f',
                shininess: 90,
                transparent: true,
                opacity: 0.95
            });
        } else if (node.group === 'db_model') {
            // Emerald sphere for Sequelize Models
            geometry = new THREE.SphereGeometry(6, 16, 16);
            material = new THREE.MeshPhongMaterial({
                color: color,
                emissive: '#047857',
                shininess: 60,
                transparent: true,
                opacity: 0.9
            });
        } else if (node.group === 'api_route') {
            // Crimson Box for Route Entrypoints
            geometry = new THREE.BoxGeometry(7, 7, 7);
            material = new THREE.MeshPhongMaterial({
                color: color,
                emissive: '#9f1239',
                shininess: 50,
                transparent: true,
                opacity: 0.9
            });
        } else if (node.group === 'fe_view') {
            // Sky Blue Card for Pages/Views
            geometry = new THREE.BoxGeometry(11, 7, 2);
            material = new THREE.MeshPhongMaterial({
                color: color,
                emissive: '#0369a1',
                shininess: 50,
                transparent: true,
                opacity: 0.9
            });
        } else {
            // Default nice sphere
            geometry = new THREE.SphereGeometry(node.size ? node.size * 0.75 : 4, 16, 16);
            material = new THREE.MeshPhongMaterial({
                color: color,
                shininess: 30,
                transparent: true,
                opacity: 0.85
            });
        }
        
        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);
        
        // Add beautiful floating text labels to key architectural components!
        if (node.group === 'database' || node.group === 'db_model' || node.group === 'fe_view' || node.id === 'server/index.js') {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 256;
            canvas.height = 64;
            
            ctx.font = 'Bold 20px Segoe UI, sans-serif';
            ctx.fillStyle = '#f8fafc';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.85)';
            ctx.shadowBlur = 4;
            
            let labelText = node.name;
            if (labelText.length > 24) labelText = labelText.substring(0, 22) + '...';
            
            ctx.fillText(labelText, 128, 40);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
            const sprite = new THREE.Sprite(spriteMaterial);
            
            // Position above the node geometry
            sprite.position.y = (node.group === 'database') ? 18 : 10;
            sprite.scale.set(30, 7.5, 1);
            group.add(sprite);
        }
        
        return group;
    })
    .nodeThreeObjectExtend(false)
    
    // Style Links
    .linkColor(link => {
        if (link.type === 'db_connection') return '#d97706'; // Gold connection
        if (link.type === 'association') return '#10b981'; // Green relational links
        if (link.type === 'api_call') return '#3b82f6'; // Flow from frontend to route
        if (link.type === 'db_query') return '#f43f5e'; // Query from route to model
        return '#334155'; // Dark blue for default imports
    })
    .linkWidth(link => {
        if (link.type === 'db_connection') return 1.5;
        if (link.type === 'association') return 1.2;
        if (link.type === 'api_call') return 1.0;
        return 0.6;
    })
    
    // Animated particles showing data flows
    .linkDirectionalParticles(link => {
        if (link.type === 'api_call' || link.type === 'db_query') return 4;
        if (link.type === 'db_connection') return 2;
        return 1;
    })
    .linkDirectionalParticleWidth(link => {
        if (link.type === 'api_call') return 1.8;
        if (link.type === 'db_query') return 1.5;
        return 0.8;
    })
    .linkDirectionalParticleSpeed(link => {
        if (link.type === 'api_call') return 0.006;
        if (link.type === 'db_query') return 0.005;
        return 0.003;
    })
    .linkDirectionalParticleColor(link => {
        if (link.type === 'db_connection') return '#f59e0b';
        if (link.type === 'association') return '#34d399';
        if (link.type === 'api_call') return '#60a5fa';
        if (link.type === 'db_query') return '#f43f5e';
        return '#475569';
    })
    
    .onNodeClick(node => {
        const dist = 140;
        const distRatio = 1 + dist / Math.hypot(node.x, node.y, node.z);
        Graph.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
            node, 1800
        );
        
        document.getElementById('node-info').style.display = 'block';
        document.getElementById('ni-name').textContent = node.name;
        document.getElementById('ni-path').textContent = node.id;
        
        const tag = document.getElementById('ni-tag');
        tag.textContent = tagLabels[node.group];
        tag.style.background = colorPalette[node.group];
    })
    .onBackgroundClick(() => {
        document.getElementById('node-info').style.display = 'none';
    });
<\/script>
</body>
</html>`;

fs.writeFileSync(viewerPath, html);
console.log(`Fully custom architectural 3D viewer compiled successfully to ${viewerPath}`);
