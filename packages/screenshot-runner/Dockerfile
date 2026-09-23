FROM node:24-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e

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

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_DOWNLOAD=true \
    CI=true

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/screenshot-runner/package.json packages/screenshot-runner/package.json

RUN pnpm install --frozen-lockfile --filter @domainstack/screenshot-runner

COPY packages/screenshot-runner packages/screenshot-runner

# The ad-blocking engine is compiled here so a capture never downloads filter
# lists at runtime. `pnpm prune --prod` has no --filter form, so reinstall
# prod-only instead.
RUN pnpm --filter @domainstack/screenshot-runner build \
    && pnpm --filter @domainstack/screenshot-runner build:blocklist \
    && rm -rf node_modules packages/screenshot-runner/node_modules \
    && pnpm install --prod --frozen-lockfile --filter @domainstack/screenshot-runner

RUN useradd --system --create-home --uid 10042 runner \
    && chown -R runner:runner /workspace

USER 10042
WORKDIR /workspace/packages/screenshot-runner
