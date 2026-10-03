FROM node:24.21.0-trixie-slim

# chromium-sandbox isn't pulled in by --no-install-recommends; it's the
# setuid fallback for hosts without unprivileged user namespaces, since the
# runner never passes --no-sandbox.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        chromium-sandbox \
        fonts-freefont-ttf \
        fonts-liberation \
        fonts-noto-cjk \
        fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    CI=true

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/screenshot-runner/package.json packages/screenshot-runner/package.json

# Node runs the TypeScript sources directly (type stripping), so nothing is
# compiled and dev dependencies are never installed.
RUN pnpm install --prod --frozen-lockfile --filter @domainstack/screenshot-runner

COPY packages/screenshot-runner packages/screenshot-runner

# The ad-blocking engine is compiled here so a capture never downloads filter
# lists at runtime.
RUN pnpm --filter @domainstack/screenshot-runner compile:blocklist

# Files stay root-owned: the runtime user only ever writes to /tmp.
RUN groupadd --system --gid 10042 runner \
    && useradd --system --create-home --uid 10042 --gid 10042 runner

USER 10042
WORKDIR /workspace/packages/screenshot-runner

# A broken image fails here, so it can never be published. Without arguments
# the runner loads every module, then reports invalid_arguments before
# launching Chromium.
RUN /usr/bin/chromium --version \
    && test -s vendor/adblock-engine.bin \
    && node --experimental-strip-types src/capture.ts | grep -q '"errorCode":"invalid_arguments"'
