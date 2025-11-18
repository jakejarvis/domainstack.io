# Repository Guidelines

## Project Structure & Module Organization
- `app/` Next.js App Router. Default to server components; keep `app/page.tsx` and `app/api/*` thin and delegate to `server/` or `lib/`.
- `components/` reusable UI primitives (kebab-case files, PascalCase exports).
- `hooks/` shared stateful helpers (camelCase named exports).
- `lib/` domain utilities and shared modules; import via `@/...` aliases.
- `lib/constants/` modular constants organized by domain (app, decay, domain-validation, external-apis, headers, ttl).
- `lib/inngest/` Inngest client and functions for event-driven background section revalidation.
- `lib/db/` Drizzle ORM schema, migrations, and repository layer for Postgres persistence.
- `lib/db/repos/` repository layer for each table (domains, certificates, dns, favicons, headers, hosting, providers, registrations, screenshots, seo).
- `server/` backend integrations and tRPC routers; isolate DNS, RDAP/WHOIS, TLS, and header probing services.
- `server/routers/` tRPC router definitions (`_app.ts` and domain-specific routers).
- `server/services/` service layer for domain data fetching (DNS, certificates, headers, hosting, registration, SEO, screenshot, favicon, etc.).
- `public/` static assets; Tailwind v4 tokens live in `app/globals.css`. Update `instrumentation-client.ts` when adding analytics.
- `trpc/` tRPC client setup, query client, and error handling.

## Build, Test, and Development Commands
- `pnpm dev` — start all local services (Postgres, Redis, SRH, Inngest) and Next.js dev server at http://localhost:3000 using `concurrently`.
- `pnpm build` — compile production bundle.
- `pnpm start` — serve compiled output for smoke tests.
- `pnpm lint` — run Biome lint + type-aware checks (`--write` to fix).
- `pnpm format` — apply Biome formatting.
- `pnpm typecheck` — run `tsc --noEmit` for stricter diagnostics.
- `pnpm test` — run Vitest in watch mode.
- `pnpm test:run` — run Vitest once.
- `pnpm test:ui` — open Vitest UI.
- `pnpm test:coverage` — run tests with coverage report.
- `pnpm db:generate` — generate Drizzle migrations from schema.
- `pnpm db:push` — push the current schema to the database.
- `pnpm db:migrate` — apply migrations to the database.
- `pnpm db:studio` — open Drizzle Studio.
- `pnpm db:seed` — run seed script (scripts/db/seed.ts).
- Requires Node.js >= 22 (see `package.json` engines).

## Coding Style & Naming Conventions
- TypeScript only, `strict` enabled; prefer small, pure modules (≈≤300 LOC).
- 2-space indentation. Files/folders: kebab-case; exports: PascalCase; helpers: camelCase named exports.
- Client components must begin with `"use client"`. Consolidate imports via `@/...`. Keep page roots lean.
- Constants: Organize by domain in `lib/constants/` submodules; re-export via `lib/constants/index.ts`.
- Use `drizzle-zod` for DB boundary validation:
  - Read schemas: `lib/db/zod.ts` `*Select` (strict `Date` types)
  - Write schemas: `lib/db/zod.ts` `*Insert`/`*Update` (dates coerced)
  - Reuse domain Zod types for JSON columns (SEO, registration) to avoid drift
  - Reference: drizzle-zod docs [drizzle-zod](https://orm.drizzle.team/docs/zod)

## Testing Guidelines
- Use **Vitest** with React Testing Library; config in `vitest.config.ts`.
- Global setup in `vitest.setup.ts`:
  - Mocks analytics clients/servers (`@/lib/analytics/server` and `@/lib/analytics/client`).
  - Mocks `server-only` module.
- Database in tests: Drizzle client is not globally mocked. Replace `@/lib/db/client` with a PGlite-backed instance when needed (`@/lib/db/pglite`).
- UI tests:
  - Do not add direct tests for `components/ui/*` (shadcn).
  - Mock Radix primitives (Accordion, Tooltip) when testing domain sections.
  - Mock tRPC/React Query for components like `Favicon` and `Screenshot`.
- Server tests:
  - Prefer `vi.hoisted` for ESM module mocks (e.g., `node:tls`).
  - Screenshot service (`server/services/screenshot.ts`) uses hoisted mocks for `puppeteer`/`puppeteer-core` and `@sparticuz/chromium`.
  - Vercel Blob storage: mock `@vercel/blob` (`put` and `del` functions). Set `BLOB_READ_WRITE_TOKEN` via `vi.stubEnv` in suites that touch uploads/deletes.
  - Repository tests (`lib/db/repos/*.test.ts`): Use PGlite for isolated in-memory database testing.
- Browser APIs: Mock `URL.createObjectURL`/`revokeObjectURL` with `vi.fn()` in tests that need them.
- Commands: `pnpm test`, `pnpm test:run`, `pnpm test:ui`, `pnpm test:coverage`.

## Commit & Pull Request Guidelines
- Commits: single-focus, imperative, sentence case (e.g., "Add RDAP caching layer").
- PRs: describe user impact, link issues, flag breaking changes/deps, and attach screenshots or terminal logs when relevant.
- Call out skipped checks and confirm `.env.local` requirements for reviewers.

## Security & Configuration Tips
- Keep secrets in `.env.local`. See `.env.example` for required variables.
- Vercel Edge Config provides dynamic, low-latency configuration without redeployment:
  - `domain_suggestions` (array): Homepage domain suggestions; fails gracefully to empty array
  - `rate_limits` (object): Service rate limits; **fails open** (no limits) if unavailable for maximum availability
  - Edge Config is completely optional and gracefully degrades when not configured
  - Uses Next.js 16 `"use cache"` directive with `@vercel/edge-config` SDK for SSR compatibility
- Vercel Blob backs favicon/screenshot storage with automatic public URLs; metadata cached in Postgres.
- Screenshots (Puppeteer): prefer `puppeteer-core` + `@sparticuz/chromium` on Vercel.
- Persist domain data in Postgres via Drizzle with per-table TTL columns (`expiresAt`).
- **Redis usage**: ONLY for IP-based rate limiting via `@upstash/ratelimit`. All other caching uses Next.js Data Cache (`unstable_cache`) or Postgres.
- Database connections: Use Vercel's Postgres connection pooling (`@vercel/postgres`) for optimal performance.
- Background revalidation: Event-driven via Inngest functions in `lib/inngest/functions/` with built-in concurrency control.
- Use Next.js 16 `after()` for fire-and-forget background operations (analytics, domain access tracking) with graceful degradation.
- Cron jobs trigger Inngest events via `app/api/cron/` endpoints secured with `CRON_SECRET`.
- Review `trpc/init.ts` when extending procedures to ensure auth/context remain intact.

## Analytics & Observability
- Uses **PostHog** for analytics and error tracking with reverse proxy via `/_proxy/ingest/*`.
- PostHog sourcemap uploads configured in `next.config.ts` with `@posthog/nextjs-config`.
- OpenTelemetry integration via `@vercel/otel` in `instrumentation.ts` for distributed tracing.
- Client-side analytics captured via `posthog-js` and initialized in `instrumentation-client.ts`.
- Server-side analytics captured via `posthog-node` in `lib/analytics/server.ts`:
  - Uses `analytics.track()` and `analytics.trackException()` for unified tracking.
  - Leverages Next.js 16 `after()` for background event capture with graceful degradation.
  - Distinct ID sourced from PostHog cookie via `cache()`-wrapped `getDistinctId()` to comply with Next.js restrictions.
- Analytics mocked in tests via `vitest.setup.ts`.
