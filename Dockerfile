# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Build backend
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
RUN npm ci
RUN npm run build

# Build frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client ./
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

RUN npm ci --only=production && npm cache clean --force



# Copy built backend from backend-builder stage

COPY --from=backend-builder /app/dist ./dist



# Copy built frontend from frontend-builder stage to the correct location

COPY --from=frontend-builder /app/client/dist ./dist/public
# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src ./src

# Install TypeScript and build dependencies
RUN npm install -D typescript @types/node
RUN npm run build

# Remove dev dependencies and TypeScript files to reduce image size
RUN npm prune --production
RUN rm -rf src tsconfig.json

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S appuser -u 1001
USER appuser

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/server.js"]
