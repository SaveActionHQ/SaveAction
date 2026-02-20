# =============================================================================
# SaveAction API + Worker Dockerfile
# Multi-stage build for the Fastify API server and BullMQ worker
#
# Usage:
#   API Server:  docker run saveaction-api node dist/server.js
#   Worker:      docker run saveaction-api node dist/worker.js
#
# The worker requires Playwright browsers for test execution.
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Base - shared Node.js base with pnpm
# ---------------------------------------------------------------------------
FROM node:22-slim AS base

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@8.10.0 --activate

WORKDIR /app

# ---------------------------------------------------------------------------
# Stage 2: Dependencies - install all workspace dependencies
# ---------------------------------------------------------------------------
FROM base AS deps

# Copy workspace config files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./

# Copy package.json for each workspace package (needed for pnpm install)
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/
# CLI not needed for API/Worker runtime
COPY packages/cli/package.json ./packages/cli/
# Web not needed for API/Worker runtime
COPY packages/web/package.json ./packages/web/

# Install ALL dependencies (including devDependencies for building)
# bcrypt needs python3 + build tools for native compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# HUSKY=0 prevents the "prepare" script from running (husky is a devDep)
RUN HUSKY=0 pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 3: Builder - compile TypeScript
# ---------------------------------------------------------------------------
FROM deps AS builder

# Copy all source files
COPY packages/core/src ./packages/core/src
COPY packages/core/tsconfig.json ./packages/core/
COPY packages/api/src ./packages/api/src
COPY packages/api/tsconfig.json ./packages/api/

# Build core first (api depends on it), then api
RUN pnpm --filter @saveaction/core build && \
    pnpm --filter @saveaction/api build

# ---------------------------------------------------------------------------
# Stage 4: Production dependencies only
# ---------------------------------------------------------------------------
FROM base AS prod-deps

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/
COPY packages/cli/package.json ./packages/cli/
COPY packages/web/package.json ./packages/web/

# bcrypt needs native build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Neutralize "prepare" script (husky is a devDep, not available in prod)
RUN sed -i 's/"prepare": "husky"/"prepare": ""/' package.json

RUN pnpm install --frozen-lockfile --prod

# ---------------------------------------------------------------------------
# Stage 5: Runtime - final production image
# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime

# Install dumb-init for proper PID 1 handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1001 saveaction && \
    useradd --uid 1001 --gid saveaction --shell /bin/bash --create-home saveaction

WORKDIR /app

# Copy production node_modules from prod-deps stage
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=prod-deps /app/packages/api/node_modules ./packages/api/node_modules

# Copy compiled dist from builder stage
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist

# Copy package.json files (needed for module resolution)
COPY --from=prod-deps /app/package.json ./
COPY --from=prod-deps /app/packages/core/package.json ./packages/core/
COPY --from=prod-deps /app/packages/api/package.json ./packages/api/

# Copy Drizzle migration files (needed for db:migrate at startup)
COPY packages/api/drizzle ./packages/api/drizzle
COPY packages/api/drizzle.config.ts ./packages/api/

# Download Playwright browsers AND install their system dependencies
# --with-deps automatically runs apt-get for all required libraries per browser
# This runs in the runtime stage to avoid Docker layer cache issues
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright-browsers
RUN cd /app/packages/core && npx playwright install --with-deps chromium firefox webkit && \
    echo "Verifying browser installation..." && \
    ls -d /app/.playwright-browsers/chromium-* && \
    ls -d /app/.playwright-browsers/firefox-* && \
    ls -d /app/.playwright-browsers/webkit-* && \
    echo "All browsers installed successfully" && \
    rm -rf /var/lib/apt/lists/*

# Create storage directories
RUN mkdir -p /app/storage/videos /app/storage/screenshots && \
    chown -R saveaction:saveaction /app

# Set default environment
ENV NODE_ENV=production
ENV API_PORT=3001
ENV API_HOST=0.0.0.0
ENV VIDEO_STORAGE_PATH=/app/storage/videos
ENV SCREENSHOT_STORAGE_PATH=/app/storage/screenshots

# Expose API port
EXPOSE 3001

# Use dumb-init to handle PID 1 properly
ENTRYPOINT ["dumb-init", "--"]

# Switch to non-root user
USER saveaction

# Default command: start API server
# Override with `node dist/worker.js` for worker containers
CMD ["node", "packages/api/dist/server.js"]
