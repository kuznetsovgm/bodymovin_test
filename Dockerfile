# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build || npx tsc

# Create necessary directories
RUN mkdir -p temp stickers public/stickers

# Expose port (if needed for web server)
EXPOSE 3000

# Default command - can be overridden in docker-compose
CMD ["node", "-r", "dotenv/config", "./dist/bot.js"]
