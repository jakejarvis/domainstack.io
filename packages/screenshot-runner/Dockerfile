FROM ghcr.io/puppeteer/puppeteer@sha256:e816d314227d2f2754b5b696f4734dcefc85fb3b1f92810a9fffc1570a27ce3e

USER root
WORKDIR /workspace

# The Puppeteer base image ships CJK, Thai and Khmer fonts but no color emoji,
# so emoji in page content render as tofu boxes without this. The version is
# pinned so a rebuild cannot silently change what the runner renders; bump it
# together with the base image digest above, since a Debian point release will
# retire this exact version and fail the build.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        fonts-noto-color-emoji=2.042-0+deb12u1 \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer \
    PUPPETEER_SKIP_DOWNLOAD=true \
    CI=true

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/screenshot-runner/package.json packages/screenshot-runner/package.json

RUN pnpm install --frozen-lockfile --filter @domainstack/screenshot-runner

COPY packages/screenshot-runner packages/screenshot-runner

# Compile the ad-blocking engine here so a capture never downloads and parses
# filter lists at runtime. This pins the lists to the image digest.
RUN pnpm --filter @domainstack/screenshot-runner build \
    && pnpm --filter @domainstack/screenshot-runner build:blocklist \
    && pnpm prune --prod

USER 10042
WORKDIR /workspace/packages/screenshot-runner
