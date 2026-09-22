# Screenshot runner image

This package builds the Chromium runner used by `@domainstack/screenshot`. It runs as a single-use [Vercel Sandbox](https://vercel.com/docs/sandbox), not inside the Next.js process.

The base is `node:24-bookworm-slim` pinned by digest, with Chromium and fonts installed from Debian, unpinned — a rebuild picks up the distro's current security build. `@domainstack/screenshot` records the browser version it actually ran. Reproducibility comes from the published image digest, which `SCREENSHOT_SANDBOX_IMAGE` requires.

Nothing a capture needs is fetched at runtime:

- **Fonts.** `fonts-liberation`, `fonts-noto-cjk`, `fonts-noto-color-emoji` and `fonts-freefont-ttf` are installed at build time. Without the emoji font in particular, emoji in page content render as tofu boxes.
- **Ad blocking.** `build:blocklist` compiles the Ghostery ads-and-tracking engine during the image build and serializes it to `dist/adblock-engine.bin`; `capture.ts` deserializes that file. Building the engine at runtime would download and parse fourteen filter lists from `raw.githubusercontent.com` before every navigation.

Blocking is best-effort: if the engine is missing or unreadable, the capture still runs and the runner reports `adblock: "unavailable"` in its JSON result, so a broken image shows up in the capture logs instead of silently degrading. A capture that failed before blocking was set up reports `adblock: "skipped"` instead.

Chromium's own sandbox needs either unprivileged user namespaces or the setuid helper from `chromium-sandbox`. The runner never passes `--no-sandbox`: the page being rendered is attacker-supplied, so a host that provides neither must surface as a launch failure rather than silently downgrading isolation.

## Local development

Authenticate Sandbox locally without committing credentials:

```bash
vercel link
vercel env pull apps/web/.env.local
```

Then run the screenshot package's focused tests, or invoke the screenshot workflow from the app.

## Publishing

`.github/workflows/build-screenshot-runner.yml` builds and publishes the image. Pull requests that touch this package build it without pushing. Pushes to `main` build and push to VCR with zstd compression, and print the resulting digest in the job summary.

Authentication uses [OIDC](https://vercel.com/docs/container-registry/github-actions) via `vercel/vcr-action/login`, so no registry credential is stored. It requires, once:

- A VCR OIDC policy on the Vercel team granting read-write access, matching this repository.
- Repository variables `VERCEL_TEAM_ID` (the `team_...` id, used to log in), plus `VERCEL_TEAM_SLUG` and `VERCEL_PROJECT_NAME` (used to build the image reference).

Publishing is not the same as rolling out. `SCREENSHOT_SANDBOX_IMAGE` only accepts an immutable digest, so promoting a new image stays a deliberate step: wait for the VCR repository details page to report `Ready` (not `Preparing` or `Unoptimized`), then set the digest the workflow printed in Preview and Production:

```text
SCREENSHOT_SANDBOX_IMAGE=vcr.vercel.com/<team-slug>/<project-name>/domainstack-screenshot@sha256:<digest>
```

Deployments authenticate to Sandbox automatically with Vercel OIDC. `latest` and mutable version tags must not be used in application configuration.

### Publishing by hand

```bash
vercel link
vercel vcr login docker
docker buildx build \
  --file packages/screenshot-runner/Dockerfile \
  --platform linux/amd64 \
  --provenance=false \
  --output "type=image,name=vcr.vercel.com/<team-slug>/<project-name>/domainstack-screenshot:latest,push=true,oci-mediatypes=true,compression=zstd,compression-level=3,force-compression=true" \
  .
```

Buildx is used directly rather than `vercel vcr build` so the compression flags apply. The build context is the monorepo root, since the Dockerfile copies the workspace manifests and lockfile, and the build needs network access to compile the ad-blocking engine.
