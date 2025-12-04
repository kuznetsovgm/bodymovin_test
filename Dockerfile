# Use Node.js LTS version
FROM node:18-alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npx tsc

# Create necessary directories
RUN mkdir -p temp stickers public/stickers

# Expose metrics port
EXPOSE 9099

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9099/health || exit 1

# Default command - can be overridden in docker-compose
CMD ["node", "-r", "dotenv/config", "./dist/bot.js"]
