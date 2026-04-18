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
            script: 'npm',
            args: 'run dev',
            watch: false,
            env: {
                NODE_ENV: 'development'
            }
        }
    ]
};
