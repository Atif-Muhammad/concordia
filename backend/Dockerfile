FROM node:20-slim

WORKDIR /app

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=3003

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Ensure upload directories exist for local and mounted storage
RUN mkdir -p /var/concordia/profile /opt/portal/uploads /app/uploads

EXPOSE 3003

# Start Express server with MongoDB
CMD ["node", "server.js"]