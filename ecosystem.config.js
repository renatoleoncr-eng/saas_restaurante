module.exports = {
    apps: [
        {
            name: 'restaurante-backend',
            cwd: './server',
            script: 'index.js',
            watch: false,
            env: {
                NODE_ENV: 'development',
                PORT: 3003
            }
        },
        {
            name: 'restaurante-frontend',
            cwd: './client',
            script: 'node_modules/vite/bin/vite.js',
            watch: false,
            env: {
                NODE_ENV: 'development'
            }
        },
        {
            name: 'restaurante-print-agent',
            script: 'print-agent.js',
            watch: false,
            env: {
                NODE_ENV: 'development'
            }
        }
    ]
};
