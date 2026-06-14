# Multi-stage build for React + Node.js

# Stage 1: Build React Frontend
FROM node:18-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
# Increase memory limit for node if needed
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Stage 2: Setup Node.js Server
FROM node:18-alpine
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --production

# Copy server code
COPY server/ ./

# Copy print agent files (served via /api/config/printers/agent-download, agent-js, print-raw-ps1)
COPY print-agent.js ../print-agent.js
COPY instalar_servicio_impresion.ps1 ../instalar_servicio_impresion.ps1

# Copy built frontend from Stage 1
COPY --from=client-build /app/client/dist ../client/dist

# Expose port (default 3004)
EXPOSE 3004

# Environment variables should be passed at runtime, but we set defaults
ENV PORT=3004
ENV NODE_ENV=production

# Start command
CMD ["node", "index.js"]
