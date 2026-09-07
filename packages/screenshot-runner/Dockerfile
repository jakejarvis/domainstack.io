FROM ghcr.io/puppeteer/puppeteer@sha256:e816d314227d2f2754b5b696f4734dcefc85fb3b1f92810a9fffc1570a27ce3e

USER root
WORKDIR /workspace

ENV PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer \
    PUPPETEER_SKIP_DOWNLOAD=true \
    CI=true

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/screenshot-runner/package.json packages/screenshot-runner/package.json

RUN pnpm install --frozen-lockfile --filter @domainstack/screenshot-runner

COPY packages/screenshot-runner packages/screenshot-runner

RUN pnpm --filter @domainstack/screenshot-runner build \
    && pnpm prune --prod

USER 10042
WORKDIR /workspace/packages/screenshot-runner
