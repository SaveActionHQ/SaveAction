# =============================================================================
# SaveAction Web UI Dockerfile
# Multi-stage build for the Next.js web dashboard
#
# Uses Next.js standalone output mode for minimal production image.
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Base - shared Node.js base with pnpm
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base

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

# Copy package.json for each workspace package (pnpm needs all of them)
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/
COPY packages/cli/package.json ./packages/cli/
COPY packages/web/package.json ./packages/web/

# HUSKY=0 prevents the "prepare" script from trying to install git hooks
RUN HUSKY=0 pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 3: Builder - build Next.js app
# ---------------------------------------------------------------------------
FROM deps AS builder

# Copy web source and config files
COPY packages/web/src ./packages/web/src
COPY packages/web/public ./packages/web/public
COPY packages/web/next.config.ts ./packages/web/
COPY packages/web/tsconfig.json ./packages/web/
COPY packages/web/postcss.config.mjs ./packages/web/
COPY packages/web/eslint.config.mjs ./packages/web/
COPY packages/web/next-env.d.ts ./packages/web/

# Set build-time environment variables
# These are baked into the Next.js bundle at build time
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_API_URL is baked into the client JS at build time.
# Default "" means relative URLs (requests go to same origin / Nginx proxy).
# Override with: docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.com
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build the Next.js app (produces standalone output)
RUN pnpm --filter @saveaction/web build

# ---------------------------------------------------------------------------
# Stage 4: Runtime - minimal production image
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime

# Install dumb-init for proper PID 1 handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 saveaction && \
    adduser --system --uid 1001 saveaction

WORKDIR /app

# Copy standalone output (includes bundled node_modules)
COPY --from=builder /app/packages/web/.next/standalone ./
# Copy static assets
COPY --from=builder /app/packages/web/.next/static ./packages/web/.next/static
# Copy public assets
COPY --from=builder /app/packages/web/public ./packages/web/public

# Set environment
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Expose port
EXPOSE 3000

# Use dumb-init as PID 1
ENTRYPOINT ["dumb-init", "--"]

# Switch to non-root user
USER saveaction

# Start the standalone Next.js server
CMD ["node", "packages/web/server.js"]
