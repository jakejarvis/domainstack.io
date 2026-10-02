FROM node:24-trixie-slim@sha256:8ec5d7557396cfe32d21c3f9c13072355ceab22b584578ca4bb28af31120cffe

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

RUN pnpm install --frozen-lockfile --filter @domainstack/screenshot-runner

COPY packages/screenshot-runner packages/screenshot-runner

# The ad-blocking engine is compiled here so a capture never downloads filter
# lists at runtime. `pnpm prune --prod` has no --filter form, so reinstall
# prod-only instead.
RUN pnpm --filter @domainstack/screenshot-runner build \
    && pnpm --filter @domainstack/screenshot-runner build:blocklist \
    && rm -rf node_modules packages/screenshot-runner/node_modules \
    && pnpm install --prod --frozen-lockfile --filter @domainstack/screenshot-runner

# Files stay root-owned: the runtime user only ever writes to /tmp.
RUN groupadd --system --gid 10042 runner \
    && useradd --system --create-home --uid 10042 --gid 10042 runner

USER 10042
WORKDIR /workspace/packages/screenshot-runner

# A broken image fails here, so it can never be published.
RUN /usr/bin/chromium --version && test -s dist/adblock-engine.bin
