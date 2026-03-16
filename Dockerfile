# ============================================================================
# Stage 1: Builder — install npm dependencies and compile native addons
# ============================================================================
FROM node:20-slim AS builder

WORKDIR /build

# Install build toolchain required by better-sqlite3 (node-gyp)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests first for layer caching
COPY package.json package-lock.json ./

# Install production dependencies. Optional deps (@google-cloud/logging,
# @sentry/node) are allowed to fail without aborting the build.
RUN npm ci --omit=dev --ignore-scripts && \
    npm rebuild better-sqlite3 && \
    npm install --optional || true

# ============================================================================
# Stage 2: Runtime — lean image with only what the app needs
# ============================================================================
FROM node:20-slim AS runtime

LABEL maintainer="ralph-pipeline" \
      org.opencontainers.image.title="ralph-pipeline" \
      org.opencontainers.image.description="Automated game-building pipeline — generates, validates, and approves HTML game artifacts from specs" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.source="https://github.com/anthropics/ralph"

WORKDIR /app

# Runtime system dependencies: bash, curl, jq (used by ralph.sh)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        bash \
        curl \
        jq \
    && rm -rf /var/lib/apt/lists/*

# Copy built node_modules from builder stage
COPY --from=builder /build/node_modules ./node_modules

# Copy application source
COPY package.json package-lock.json ./
COPY server.js worker.js ralph.sh ./
COPY lib/ ./lib/
COPY playwright.config.js ./

# Make ralph.sh executable
RUN chmod +x ralph.sh

# Install Playwright Chromium with OS-level dependencies.
# npx resolves playwright from the devDependencies-free node_modules, so we
# install just the @playwright/test package needed for the CLI, then fetch
# the browser binary.
RUN npm install @playwright/test && \
    npx playwright install chromium --with-deps && \
    rm -rf /tmp/* /root/.cache/ms-playwright/.links

# Create non-root user for security
RUN groupadd --gid 1001 ralph && \
    useradd --uid 1001 --gid ralph --shell /bin/bash --create-home ralph

# Create data directory for SQLite persistence and set ownership
RUN mkdir -p /app/data && chown -R ralph:ralph /app

# Declare volume for SQLite databases
VOLUME /app/data

# Switch to non-root user
USER ralph

# Expose the webhook server port
EXPOSE 3000

# Health check against the Express /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Default command: start the webhook server
CMD ["node", "server.js"]
