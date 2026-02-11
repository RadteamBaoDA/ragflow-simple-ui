# ============================================================
# Stage 1 – Build
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source files for compilation
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript → dist/
RUN npm run build:prod

# ============================================================
# Stage 2 – Production
# ============================================================
FROM node:22-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Copy runtime assets
COPY public ./public

# Create runtime directories
RUN mkdir -p logs .data config && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the application (new entry point after Nx-style restructure)
CMD ["node", "dist/app/index.js"]
