# Screenshot runner image

This package builds the immutable Chromium runner used by `@domainstack/screenshot`. The base image is the official Puppeteer 25.1.0 linux/amd64 image pinned by digest; it includes Chromium 149.0.7827.22 and browser fonts. Dependencies are installed while the image is built, never when a Sandbox starts.

Nothing a capture needs is fetched at runtime:

- **Fonts.** The base image ships CJK, Thai and Khmer fonts but no color emoji, so the Dockerfile adds `fonts-noto-color-emoji`. Without it, emoji in page content render as tofu boxes.
- **Ad blocking.** `build:blocklist` compiles the Ghostery ads-and-tracking engine during the image build and serializes it to `dist/adblock-engine.bin`; `capture.ts` deserializes that file. Building the engine at runtime would download and parse fourteen filter lists from `raw.githubusercontent.com` before every navigation. Baking it also pins the filter lists to the image digest, so refreshing them means publishing a new image.

Blocking is best-effort. If the engine is missing or unreadable the capture still runs, and the runner reports `adblock: "unavailable"` in its JSON result so a broken image shows up in the capture logs instead of silently degrading. A capture that failed before blocking was set up reports `adblock: "skipped"` instead, which says nothing about the engine.

## Local smoke test

Authenticate Sandbox locally without committing credentials:

```bash
vercel link
vercel env pull apps/web/.env.local
```

Build and exercise the runner itself:

```bash
pnpm --filter @domainstack/screenshot-runner smoke:docker
```

Prefer `smoke:docker` over the plain `smoke` script: `smoke` runs the TypeScript source directly, where no compiled engine sits next to it, so it always reports `adblock: "unavailable"`.

After a VCR image is configured in `apps/web/.env.local`, run the screenshot package's focused tests or invoke the screenshot workflow from the app.

## Publish to Vercel Container Registry

Publishing is a manual operational action. Do not run these commands from automation until the project has explicitly authorized image publication.

```bash
vercel link
vercel vcr login docker
docker buildx build \
  --file packages/screenshot-runner/Dockerfile \
  --platform linux/amd64 \
  --pull \
  --provenance=false \
  --tag vcr.vercel.com/<team-slug>/<project-slug>/domainstack-screenshot:<version> \
  --output "type=image,push=true,oci-mediatypes=true,compression=zstd,compression-level=3,force-compression=true" \
  .
```

`vercel vcr login docker` writes the VCR-managed registry credentials, then Buildx builds and pushes in one operation. Buildx is used directly rather than `vercel vcr build` so the output flags apply: zstd with OCI media types decompresses faster than the default gzip, which is on the Sandbox boot path for every capture. `--provenance=false` keeps the push to a single-platform manifest instead of an index.

The build context is the monorepo root, since the Dockerfile copies the workspace manifests and lockfile. Compiling the ad-blocking engine requires network access during the build.

Wait for the repository details page to report `Ready`, not `Preparing` or `Unoptimized`. Then inspect the published tag and copy its immutable `sha256` digest:

```bash
vercel vcr tag inspect domainstack-screenshot <version>
```

Set the same digest-qualified reference in Preview and Production:

```text
SCREENSHOT_SANDBOX_IMAGE=domainstack-screenshot@sha256:<digest>
```

Deployments authenticate to Sandbox automatically with Vercel OIDC. `latest` and mutable version tags must not be used in application configuration.
