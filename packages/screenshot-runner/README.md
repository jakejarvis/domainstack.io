# Screenshot runner image

This package builds the immutable Chromium runner used by `@domainstack/screenshot`. The base image is the official Puppeteer 25.1.0 linux/amd64 image pinned by digest; it includes Chromium 149.0.7827.22 and browser fonts. Dependencies are installed while the image is built, never when a Sandbox starts.

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

After a VCR image is configured in `apps/web/.env.local`, run the screenshot package's focused tests or invoke the screenshot workflow from the app.

## Publish to Vercel Container Registry

Publishing is a manual operational action. Do not run these commands from automation until the project has explicitly authorized image publication.

```bash
vercel link
vercel vcr login docker
vercel vcr build \
  --platform linux/amd64 \
  docker . domainstack-screenshot:<version> \
  --push \
  -- --file packages/screenshot-runner/Dockerfile
```

The build command uses VCR's linked-project repository naming and forwards the custom Dockerfile path to Docker. It also builds and pushes in one operation with the VCR-managed registry credentials.

Wait for the repository details page to report `Ready`, not `Preparing` or `Unoptimized`. Then inspect the published tag and copy its immutable `sha256` digest:

```bash
vercel vcr tag inspect domainstack-screenshot <version>
```

Set the same digest-qualified reference in Preview and Production:

```text
SCREENSHOT_SANDBOX_IMAGE=domainstack-screenshot@sha256:<digest>
```

Deployments authenticate to Sandbox automatically with Vercel OIDC. `latest` and mutable version tags must not be used in application configuration.
