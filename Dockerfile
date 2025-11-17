# Multi-stage build for NestJS backend with Prisma

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Update npm to latest version to avoid hanging issues
RUN npm install -g npm@latest

# Copy package files
COPY package*.json ./
COPY tsconfig.base.json ./
COPY nx.json ./

# Install all dependencies (using npm install since lock file may be out of sync)
RUN npm install --legacy-peer-deps

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Generate Prisma Client with custom output
WORKDIR /app/server
RUN npx prisma generate

# Build the application
WORKDIR /app
RUN npx nx build server --prod

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

# Update npm to latest version
RUN npm install -g npm@latest

# Install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist/server ./dist/server

# Copy Prisma generated client
COPY --from=builder /app/server/generated ./server/generated

# Copy Prisma schema and seed files for migrations
COPY --from=builder /app/server/prisma ./server/prisma

# Expose the application port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/server/main.js"]
