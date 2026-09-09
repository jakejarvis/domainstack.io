# node:24-slim, named explicitly: the Debian release decides the pinned font
# version below, so it must not drift silently when the `24-slim` alias moves.
FROM node:24-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e

# Chromium comes from Debian rather than a prebuilt browser image, and is
# deliberately not version-pinned: it renders untrusted pages, so a rebuild
# should pick up the distro's current security build. Reproducibility comes
# from the published image digest instead, which SCREENSHOT_SANDBOX_IMAGE
# requires.
#
# chromium-sandbox is not pulled in by --no-install-recommends, but it provides
# the setuid helper Chromium falls back to when the host does not expose
# unprivileged user namespaces. The runner never passes --no-sandbox, so this
# is what keeps it working on a host that lacks them.
#
# The font packages are pinned: unlike the browser they are inert glyph data,
# and drift would silently change what screenshots look like. Bump them with
# the base image, since a Debian point release retires the exact version and
# fails the build.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        chromium \
        chromium-sandbox \
        fonts-freefont-ttf \
        fonts-liberation \
        fonts-noto-cjk \
        fonts-noto-color-emoji=2.042-0+deb12u1 \
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

# The ad-blocking engine is compiled here so a capture never downloads and
# parses filter lists at runtime. This pins the lists to the image digest.
RUN pnpm --filter @domainstack/screenshot-runner build \
    && pnpm --filter @domainstack/screenshot-runner build:blocklist \
    && pnpm prune --prod

# Chromium's sandbox refuses to start as root and the runner never disables it,
# so captures have to run unprivileged.
RUN useradd --system --create-home --uid 10042 runner \
    && chown -R runner:runner /workspace

USER 10042
WORKDIR /workspace/packages/screenshot-runner
