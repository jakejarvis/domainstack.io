# Repository Guidelines

## Project Structure & Module Organization
- `app/` Next.js App Router. Default to server components; keep `app/page.tsx` and `app/api/*` thin and delegate to `server/` or `lib/`.
- `app/dashboard/` Protected dashboard for domain tracking with Active/Archived tabs.
- `components/` reusable UI primitives (kebab-case files, PascalCase exports).
- `components/auth/` Authentication components (sign-in button, user menu, login content).
- `components/dashboard/` Dashboard components (domain cards, tables, settings, add domain dialog, upgrade prompt, subscription section, archived domains view).
- `emails/` React Email templates for notifications (domain expiry, certificate expiry, verification status).
- `hooks/` shared stateful helpers (camelCase named exports).
- `lib/` domain utilities and shared modules; import via `@/...` aliases.
- `lib/auth.ts` better-auth server configuration with Drizzle adapter.
- `lib/auth-client.ts` better-auth client for React hooks (`useSession`, `signIn`, `signOut`).
- `lib/constants/` modular constants organized by domain (app, decay, domain-validation, notifications, tier-limits, headers, ttl).
- `lib/inngest/` Inngest client and functions for background jobs (section revalidation, expiry checks, domain re-verification).
- `lib/db/` Drizzle ORM schema, migrations, and repository layer for Postgres persistence.
- `lib/db/repos/` repository layer for each table (domains, certificates, dns, favicons, headers, hosting, providers, registrations, screenshots, seo, tracked-domains, user-limits, user-notification-preferences, notifications).
- `lib/logger/` unified structured logging system with OpenTelemetry integration, correlation IDs, and PII-safe field filtering.
- `lib/polar/` Polar subscription integration (products config, webhook handlers, downgrade logic).
- `lib/resend.ts` Resend email client for sending notifications.
- `lib/schemas/` Zod schemas organized by domain.
- `server/` backend integrations and tRPC routers; isolate DNS, RDAP/WHOIS, TLS, and header probing services.
- `server/routers/` tRPC router definitions (`_app.ts`, `domain.ts`, `tracking.ts`).
- `server/services/` service layer for domain data fetching (DNS, certificates, headers, hosting, registration, SEO, screenshot, favicon, verification).
- `public/` static assets; Tailwind v4 tokens live in `app/globals.css`. Update `instrumentation-client.ts` when adding analytics.
- `trpc/` tRPC client setup, query client, error handling, and `protectedProcedure` for auth-required endpoints.

## Build, Test, and Development Commands
- `pnpm dev` — start all local services (Postgres, Inngest, etc.) and Next.js dev server at http://localhost:3000 using `concurrently`.
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
- Uses `threads` pool for compatibility with sandboxed environments (e.g., Cursor agent commands).
- Global setup in `vitest.setup.ts`:
  - Mocks analytics clients/servers (`@/lib/analytics/server` and `@/lib/analytics/client`).
  - Mocks logger clients/servers (`@/lib/logger/server` and `@/lib/logger/client`).
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
  - `tier_limits` (object): `{ free: 5, pro: 50 }` for domain tracking limits per tier
- Vercel Blob backs favicon/screenshot storage with automatic public URLs; metadata cached in Postgres.
- Screenshots (Puppeteer): prefer `puppeteer-core` + `@sparticuz/chromium` on Vercel.
- Persist domain data in Postgres via Drizzle with per-table TTL columns (`expiresAt`).
- All caching uses Next.js Data Cache (`fetch` with `next: { revalidate }`) or Postgres.
- Database connections: Use Vercel's Postgres connection pooling (`@vercel/postgres`) for optimal performance.
- Background revalidation: Event-driven via Inngest functions in `lib/inngest/functions/` with built-in concurrency control.
- Use Next.js 16 `after()` for fire-and-forget background operations (analytics, domain access tracking) with graceful degradation.
- Review `trpc/init.ts` when extending procedures to ensure auth/context remain intact.

## Authentication (better-auth)
- **Server config:** `lib/auth.ts` - betterAuth with Drizzle adapter, GitHub OAuth, Polar plugin for subscriptions.
- **Client hooks:** `lib/auth-client.ts` - `useSession`, `signIn`, `signOut`, `getSession`, `checkout`, `customerPortal`.
- **Protected routes:** Dashboard layout (`app/dashboard/layout.tsx`) checks session server-side and redirects to `/login`.
- **tRPC integration:** `trpc/init.ts` exports `protectedProcedure` that requires valid session; throws `UNAUTHORIZED` otherwise.
- **Schema tables:** `users`, `sessions`, `accounts`, `verifications` in `lib/db/schema.ts`.
- **Login modal:** Uses simple React dialog triggered from header; fallback full page at `/login`.
- **Environment variables:** `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.

## Domain Tracking System
The domain tracking feature allows authenticated users to track domains they own, receive expiration notifications, and manage notification preferences.

### Core Tables
- `tracked_domains`: Links users to domains with verification status, token, per-domain notification overrides, and `archivedAt` for soft-archiving.
- `user_limits`: User tier (free/pro) with optional `maxDomainsOverride` for special cases, and `subscriptionEndsAt` for canceled-but-active subscriptions.
- `user_notification_preferences`: Global notification toggles (domainExpiry, certificateExpiry, verificationStatus).
- `notifications`: History of sent notifications with Resend email ID for troubleshooting.

### Domain Verification
Users must verify domain ownership via one of three methods:
1. **DNS TXT record:** Add `_domainstack-verify.domain.com TXT "token"`.
2. **HTML file:** Upload `/.well-known/domainstack-verify.txt` containing the token.
3. **Meta tag:** Add `<meta name="domainstack-verify" content="token">` to homepage.

Verification service: `server/services/verification.ts` with `tryAllVerificationMethods()` and `verifyDomainOwnership()`.

### Re-verification & Grace Period
- Inngest function `reverifyDomains` runs daily at 4 AM UTC.
- Auto-verifies pending domains (users who added verification but never clicked "Verify").
- Re-verifies existing domains; if failing, enters 7-day grace period before revocation.
- Sends `verification_failing` email on first failure, `verification_revoked` on revocation.

### Notification System
- **Categories:** `domainExpiry`, `certificateExpiry`, `verificationStatus` (defined in `lib/constants/notifications.ts`).
- **Thresholds:** Domain expiry: 30, 14, 7, 1 days. Certificate expiry: 14, 7, 3, 1 days.
- **Per-domain overrides:** `notificationOverrides` JSONB column; `undefined` = inherit from global, explicit `true/false` = override.
- **Idempotency:** Notification records created before email send; Resend idempotency keys prevent duplicates on retry.
- **Troubleshooting:** `resendId` column stores Resend email ID for delivery debugging.

### tRPC Router (`server/routers/tracking.ts`)
Key procedures:
- `addDomain`: Add domain to tracking (or resume unverified).
- `verifyDomain`: Verify ownership.
- `removeDomain`: Delete tracked domain.
- `archiveDomain` / `unarchiveDomain`: Soft-archive or reactivate domains.
- `listDomains` / `listArchivedDomains`: Get active or archived tracked domains.
- `getLimits`: Get user's tier, active/archived counts, and max domains.
- `getNotificationPreferences` / `updateGlobalNotificationPreferences`: Global toggles.
- `updateDomainNotificationOverrides` / `resetDomainNotificationOverrides`: Per-domain overrides.

### Inngest Background Jobs
- `check-domain-expiry`: Daily at 9 AM UTC; sends domain expiration notifications.
- `check-certificate-expiry`: Daily at 10 AM UTC; sends certificate expiration notifications.
- `reverify-domains`: Daily at 4 AM UTC; auto-verifies pending and re-verifies existing domains.

## Email Notifications (Resend + React Email)
- **Client:** `lib/resend.ts` exports `resend` client and `RESEND_FROM_EMAIL`.
- **Templates:** `emails/` directory with React Email components (domain-expiry, certificate-expiry, verification-failing, verification-revoked).
- **Idempotency:** Use `generateIdempotencyKey(trackedDomainId, notificationType)` and pass to `resend.emails.send()`.
- **Pattern:** Create notification record → Send email → Update with `resendId` for troubleshooting.
- **Environment variables:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

## Subscriptions (Polar)
Polar handles Pro tier subscriptions with automatic tier management via webhooks.

### Product Configuration
- **Config file:** `lib/polar/products.ts` defines products with IDs, slugs, tiers, and pricing.
- **Pro tier:** Two products for billing flexibility: `pro-monthly` ($2/month) and `pro-yearly` ($20/year).
- **Checkout:** Pass both product IDs to let users choose billing interval at checkout.

### Integration
- **Server:** `lib/auth.ts` includes Polar plugin with `checkout`, `portal`, and `webhooks` handlers.
- **Client:** `lib/auth-client.ts` exports `checkout()` and `customerPortal()` for UI triggers.
- **Webhook handlers:** `lib/polar/handlers.ts`:
  - `handleSubscriptionCreated` - logs subscription initiation (payment may still be pending)
  - `handleSubscriptionActive` - upgrades tier after payment confirmed, clears any pending cancellation
  - `handleSubscriptionCanceled` - stores `subscriptionEndsAt` to show banner (user keeps access until period ends)
  - `handleSubscriptionRevoked` - triggers downgrade and clears `subscriptionEndsAt`
- **Downgrade logic:** `lib/polar/downgrade.ts` archives oldest domains beyond free tier limit.

### UI Components
- **Upgrade prompt:** `components/dashboard/upgrade-prompt.tsx` - contextual banner when near/at domain limit.
- **Subscription ending banner:** `components/dashboard/subscription-ending-banner.tsx` - shows when subscription is canceled but still active.
- **Dashboard banner:** `components/dashboard/dashboard-banner.tsx` - generic banner with variants (info, warning, success, danger, pro).
- **Subscription section:** `components/dashboard/subscription-section.tsx` - settings page with plan info and manage/upgrade buttons.
- **Archived domains:** `components/dashboard/archived-domains-view.tsx` - view and reactivate archived domains.

### Domain Archiving
- Archived domains don't count against user's limit.
- Users can manually archive/unarchive from dashboard tabs.
- On downgrade, oldest domains are auto-archived to enforce free tier limit.
- Unarchiving checks capacity before allowing reactivation.

### Environment variables
- `POLAR_ACCESS_TOKEN`: API token from Polar dashboard.
- `POLAR_WEBHOOK_SECRET`: Webhook secret for signature verification.

## TanStack Query Best Practices
Dashboard components use optimistic updates for responsive UX:

```typescript
const removeMutation = useMutation({
  ...trpc.tracking.removeDomain.mutationOptions(),
  onMutate: async ({ trackedDomainId }) => {
    await queryClient.cancelQueries({ queryKey: domainsQueryKey });
    const previousDomains = queryClient.getQueryData(domainsQueryKey);
    
    // Optimistically update
    queryClient.setQueryData(domainsQueryKey, (old) =>
      old?.filter((d) => d.id !== trackedDomainId)
    );
    
    return { previousDomains }; // Snapshot for rollback
  },
  onError: (err, _variables, context) => {
    // Rollback on error
    if (context?.previousDomains) {
      queryClient.setQueryData(domainsQueryKey, context.previousDomains);
    }
  },
  onSettled: () => {
    // Always invalidate to ensure consistency
    void queryClient.invalidateQueries({ queryKey: domainsQueryKey });
  },
});
```

Key patterns:
- Use `onMutate` for optimistic updates with snapshot.
- Use `onError` for rollback.
- Use `onSettled` (not `onSuccess`) for invalidation—runs on both success and error.
- Call `cancelQueries` before optimistic update to prevent race conditions.
- Use `typeof query.data` for type-safe updaters.

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

## Structured Logging
- Unified logging system in `lib/logger/` with server (`lib/logger/server.ts`) and client (`lib/logger/client.ts`) implementations.
- **Server-side logging:**
  - Import singleton: `import { logger } from "@/lib/logger/server"`
  - Or create service logger: `const logger = createLogger({ source: "dns" })`
  - Automatic OpenTelemetry trace/span ID injection from `@vercel/otel`
  - Correlation ID tracking via AsyncLocalStorage for request tracing
  - Critical errors automatically tracked in PostHog via `after()`
  - Log levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`
- **Client-side logging:**
  - Import singleton: `import { logger } from "@/lib/logger/client"`
  - Or use hook: `const logger = useLogger({ component: "MyComponent" })`
  - Errors automatically tracked in PostHog
  - Console output only in development (info/debug) and always for errors
  - Correlation IDs propagated from server via header/cookie/localStorage
- **Log format:** Structured JSON with consistent fields (level, message, timestamp, context, correlationId, traceId, spanId, environment).
- **Usage examples:**
  ```typescript
  // Server (service layer)
  import { createLogger } from "@/lib/logger/server";
  const logger = createLogger({ source: "dns" });
  logger.debug("start example.com", { domain: "example.com" });
  logger.info("ok example.com", { domain: "example.com", count: 5 });
  logger.error("failed to resolve", error, { domain: "example.com" });

  // Client (components)
  import { useLogger } from "@/hooks/use-logger";
  const logger = useLogger({ component: "DomainSearch" });
  logger.info("search initiated", { domain: query });
  logger.error("search failed", error, { domain: query });
  ```
- **Correlation IDs:** Generated server-side, propagated to client via `x-correlation-id` header, stored in cookie/localStorage. Enables request tracing across services.
- **Integration with tRPC:** Middleware in `trpc/init.ts` automatically logs all procedures with correlation IDs and OpenTelemetry context.
- **Testing:** Logger mocked in `vitest.setup.ts`. Use `vi.mocked(logger.info)` to assert log calls in tests.

