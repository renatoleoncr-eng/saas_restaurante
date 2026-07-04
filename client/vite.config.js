import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5174,
        host: true, // Needed for Docker exposure and subdomain testing
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:3003',
                changeOrigin: true,
                secure: false,
            },
            '/uploads': {
                target: 'http://127.0.0.1:3003',
                changeOrigin: true,
                secure: false,
            },
            '/socket.io': {
                target: 'http://127.0.0.1:3003',
                ws: true,
            }
        }
    }
})
