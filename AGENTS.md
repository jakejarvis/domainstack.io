# Repository Guidelines

## Project Structure & Module Organization
- `app/` Next.js App Router. Default to server components; keep `app/page.tsx` and `app/api/*` thin and delegate to `server/` or `lib/`.
- `app/dashboard/` Protected dashboard for domain tracking with Active/Archived tabs.
- `app/bookmarklet/` Bookmarklet installation and standalone pages.
- `app/@modal/` Intercepting routes for modal dialogs (`(.)login`, `(.)dashboard`, `(.)settings`, `(.)bookmarklet`).
- `components/` reusable UI primitives (kebab-case files, PascalCase exports).
- `components/auth/` Authentication components (sign-in button, user menu, login content).
- `components/dashboard/` Dashboard components (domain cards, tables, add domain dialog, upgrade prompt, archived domains view, bulk actions toolbar, domain filters, health summary, verification badges, provider tooltips).
- `components/settings/` Settings page components (subscription section, notification settings, linked accounts, danger zone/account deletion).
- `emails/` React Email templates for notifications (domain expiry, certificate expiry, verification status, subscription lifecycle).
- `hooks/` shared stateful helpers (camelCase named exports): `useAuthCallback`, `useCustomerPortal`, `useDashboardFilters`, `useDashboardPreferences`, `useDashboardSort`, `useDomainExport`, `useDomainHistory`, `useDomainMutations`, `useDomainSearch`, `useDomainVerification`, `useIsMac`, `useLogger`, `useMediaQuery`, `useMobile`, `useNotificationMutations`, `usePointerCapability`, `useProgressiveReveal`, `useProviderTooltipData`, `useRouter`, `useSelection`, `useSubscription`, `useTablePagination`, `useTheme`, `useTrackedDomains`, `useTruncation`, `useUpgradeCheckout`.
- `lib/` domain utilities and shared modules; import via `@/...` aliases.
- `lib/auth.ts` better-auth server configuration with Drizzle adapter.
- `lib/auth-client.ts` better-auth client for React hooks (`useSession`, `signIn`, `signOut`).
- `lib/constants/` modular constants organized by domain (app, auth-errors, decay, domain-filters, domain-validation, email, gdpr, headers, notifications, oauth-providers, pricing-providers, sections, tier-limits, ttl, verification).
- `lib/dns-utils.ts` shared DNS over HTTPS (DoH) utilities: provider list, header constants, URL builder, and deterministic provider ordering for cache consistency.
- `lib/inngest/` Inngest client and functions for background jobs. Uses fan-out pattern with separate `scheduler` and `worker` functions for scalability.
- `lib/db/` Drizzle ORM schema, migrations, and repository layer for Postgres persistence.
- `lib/db/repos/` repository layer for each table (blocked-domains, domains, certificates, dns, favicons, headers, hosting, notifications, providers, provider-logos, registrations, screenshots, seo, snapshots, stats, tracked-domains, user-notification-preferences, user-subscription, users).
- `lib/logger/` unified structured logging system with console-based JSON logging for both server and client.
- `lib/polar/` Polar subscription integration (products config, webhook handlers, downgrade logic, subscription emails).
- `lib/resend.ts` Resend email client for sending notifications.
- `lib/providers/` provider detection system (catalog.ts for Edge Config schema, detection.ts for pattern matching, parser.ts for catalog parsing).
- `lib/icons/` icon pipeline for favicon extraction (pipeline.ts for multi-source extraction, sources.ts for source definitions).
- `lib/schemas/` Zod schemas organized by domain.
- `server/` backend integrations and tRPC routers; isolate DNS, RDAP/WHOIS, TLS, and header probing services.
- `server/routers/` tRPC router definitions (`_app.ts`, `domain.ts`, `notifications.ts`, `provider.ts`, `registrar.ts`, `stats.ts`, `tracking.ts`, `user.ts`).
- `server/services/` service layer for domain data fetching (DNS, certificates, headers, hosting, icons, IP, pricing, registration, screenshot, SEO, verification).
- `public/` static assets; Tailwind v4 tokens live in `app/globals.css`. Update `instrumentation-client.ts` when adding analytics.
- `trpc/` tRPC client setup, query client, error handling, and `protectedProcedure` for auth-required endpoints.

## Build, Test, and Development Commands
- `pnpm dev` — start all local services (Postgres, Inngest, ngrok, etc.) and Next.js dev server at http://localhost:3000 using `concurrently`.
- `pnpm build` — compile production bundle.
- `pnpm start` — serve compiled output for smoke tests.
- `pnpm lint` — run Biome lint + type-aware checks (`--write` to fix).
- `pnpm format` — apply Biome formatting.
- `pnpm typecheck` — run `tsc --noEmit` for stricter diagnostics.
- `pnpm test` — run Vitest in watch mode.
- `pnpm test:run` — run Vitest once.
- `pnpm test:coverage` — run tests with coverage report.
- `pnpm db:generate` — generate Drizzle migrations from schema.
- `pnpm db:push` — push the current schema to the database.
- `pnpm db:migrate` — apply migrations to the database.
- `pnpm db:studio` — open Drizzle Studio.
- Requires Node.js >= 24 (see `package.json` engines).
- Local development includes ngrok tunnel for webhook testing; public URL displayed in terminal output.

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
- Use **Vitest** with **Browser Mode** (Playwright) for component testing; config in `vitest.config.ts`.
- Uses `threads` pool for compatibility with sandboxed environments (e.g., Cursor agent commands).
- Global setup:
  - `vitest.setup.node.ts` for Node environment tests (services, utils).
  - `vitest.setup.browser.ts` for Browser environment tests (components).
  - Mocks analytics clients/servers (`@/lib/analytics/server` and `@/lib/analytics/client`).
  - Mocks logger clients/servers (`@/lib/logger/server` and `@/lib/logger/client`).
  - Mocks `server-only` module.
- Database in tests: Drizzle client is not globally mocked. Replace `@/lib/db/client` with a PGlite-backed instance when needed (`@/lib/db/pglite`).
- UI tests:
  - Do not add direct tests for `components/ui/*` (shadcn).
  - Mock tRPC/React Query for components like `Favicon` and `Screenshot`.
- Server tests:
  - Prefer `vi.hoisted` for ESM module mocks (e.g., `node:tls`).
  - Screenshot service (`server/services/screenshot.ts`) uses hoisted mocks for `puppeteer`/`puppeteer-core` and `@sparticuz/chromium`.
  - Vercel Blob storage: mock `@vercel/blob` (`put` and `del` functions). Set `BLOB_READ_WRITE_TOKEN` via `vi.stubEnv` in suites that touch uploads/deletes.
  - Repository tests (`lib/db/repos/*.test.ts`): Use PGlite for isolated in-memory database testing.
- Browser APIs: Mock `URL.createObjectURL`/`revokeObjectURL` with `vi.fn()` in tests that need them.
- Commands: `pnpm test`, `pnpm test:run`, `pnpm test:coverage`.

## Commit & Pull Request Guidelines
- Commits: single-focus, imperative, sentence case (e.g., "Add RDAP caching layer").
- PRs: describe user impact, link issues, flag breaking changes/deps, and attach screenshots or terminal logs when relevant.
- Call out skipped checks and confirm `.env.local` requirements for reviewers.

## Security & Configuration Tips
- Keep secrets in `.env.local`. See `.env.example` for required variables.
- Vercel Edge Config provides dynamic, low-latency configuration without redeployment:
  - `domain_suggestions` (array): Homepage domain suggestions; fails gracefully to empty array
  - `tier_limits` (object): `{ free: 5, pro: 50 }` for domain tracking limits per tier
  - `provider_catalog` (object): Provider detection rules for CA, DNS, email, hosting, and registrar providers. Structure: `{ ca: [...], dns: [...], email: [...], hosting: [...], registrar: [...] }`. Providers are lazily inserted into the database on first detection.
  - `screenshot_blocklist_sources` (array): URLs of external blocklists (e.g., OISD NSFW) for screenshot/OG image blocking; fails gracefully to empty array (allows all domains)
- Vercel Blob backs favicon/screenshot storage with automatic public URLs; metadata cached in Postgres.
- Screenshots (Puppeteer): prefer `puppeteer-core` + `@sparticuz/chromium` on Vercel.
- Persist domain data in Postgres via Drizzle with per-table TTL columns (`expiresAt`).
- All caching uses Next.js Data Cache (`fetch` with `next: { revalidate }`) or Postgres.
- Database connections: Use Vercel's Postgres connection pooling (`@vercel/postgres`) for optimal performance.
- Background revalidation: Event-driven via Inngest functions in `lib/inngest/functions/` with built-in concurrency control.
- Use Next.js 16 `after()` for fire-and-forget background operations (analytics, domain access tracking) with graceful degradation.
- Review `trpc/init.ts` when extending procedures to ensure auth/context remain intact.

## Authentication (better-auth)
- **Server config:** `lib/auth.ts` - betterAuth with Drizzle adapter, third-party OAuth, Polar plugin for subscriptions.
- **Client hooks:** `lib/auth-client.ts` - `useSession`, `signIn`, `signOut`, `getSession`, `checkout`, `customerPortal`.
- **Protected routes:** Dashboard layout (`app/dashboard/layout.tsx`) checks session server-side and redirects to `/login`.
- **tRPC integration:** `trpc/init.ts` exports `protectedProcedure` that requires valid session; throws `UNAUTHORIZED` otherwise.
- **Schema tables:** `users`, `sessions`, `accounts`, `verifications` in `lib/db/schema.ts`.
- **Login modal:** Uses simple React dialog triggered from header; fallback full page at `/login`.
- **Resend contacts integration:** User creation/deletion automatically syncs with Resend contacts.
  - User creation: Parses name into firstName/lastName and creates Resend contact.
  - User deletion: Removes contact from Resend.
  - All operations are graceful (won't block auth flows if Resend fails).
- **Environment variables:** `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITLAB_CLIENT_ID`, `GITLAB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `VERCEL_CLIENT_ID`, `VERCEL_CLIENT_SECRET`, `LOGO_DEV_PUBLISHABLE_KEY`.

## Domain Tracking System
The domain tracking feature allows authenticated users to track domains they own, receive expiration notifications, and manage notification preferences.

### Core Tables
- `tracked_domains`: Links users to domains with verification status, token, per-domain notification overrides, and `archivedAt` for soft-archiving.
- `user_subscriptions`: User tier (free/pro), `endsAt` for canceled-but-active subscriptions, and `lastExpiryNotification` for tracking sent reminders.
- `user_notification_preferences`: Global notification toggles (domainExpiry, certificateExpiry, registrationChanges, providerChanges, certificateChanges). Note: Verification notifications are always sent and cannot be disabled.
- `notifications`: History of sent notifications with Resend email ID for troubleshooting.

### Subscription Repository (`lib/db/repos/user-subscription.ts`)
- `getUserSubscription`: Get user's tier, max domains, and subscription end date.
- `updateUserTier`: Upgrade/downgrade user tier (creates missing record if needed).
- `setSubscriptionEndsAt` / `clearSubscriptionEndsAt`: Track canceled subscription end dates.
- `getUsersWithEndingSubscriptions`: Query for subscription expiry cron job.
- `setLastExpiryNotification`: Track which expiry notifications have been sent.

### Domain Verification
Users must verify domain ownership via one of three methods:
1. **DNS TXT record:** Add `domain.com TXT "domainstack-verify=token"` (displayed as `@` for the hostname).
2. **HTML file:** Upload `/.well-known/domainstack-verify.html` containing the token.
3. **Meta tag:** Add `<meta name="domainstack-verify" content="token">` to homepage.

Verification service: `server/services/verification.ts` with `tryAllVerificationMethods()` and `verifyDomainOwnership()`. Uses shared DoH utilities from `lib/dns-utils.ts` for redundant DNS verification across multiple providers (Cloudflare, Google).

### Re-verification & Grace Period
- Inngest function `reverifyDomains` runs daily at 4 AM UTC.
- Auto-verifies pending domains (users who added verification but never clicked "Verify").
- Re-verifies existing domains; if failing, enters 7-day grace period before revocation.
- Sends `verification_failing` email on first failure, `verification_revoked` on revocation.

### Notification System
- **Categories:** `domainExpiry`, `certificateExpiry`, `registrationChanges`, `providerChanges`, `certificateChanges` (defined in `lib/constants/notifications.ts`).
- **Channels:** In-app notifications (via `notifications` table) and Email (via Resend).
- **Important:** Verification status notifications (`verification_failing`, `verification_revoked`) are always sent and cannot be disabled via preferences.
- **Thresholds:** Domain expiry: 30, 14, 7, 1 days. Certificate expiry: 14, 7, 3, 1 days.
- **Per-domain overrides:** `notificationOverrides` JSONB column; `undefined` = inherit from global, explicit `true/false` = override.
- **Global Preferences:** Stored in `user_notification_preferences` as JSONB objects `{ inApp: boolean, email: boolean }` for each category.
- **Idempotency:** Notification records created before email send; Resend idempotency keys prevent duplicates on retry.
- **Troubleshooting:** `resendId` column stores Resend email ID for delivery debugging.
- **Change Detection:** `domain_snapshots` table tracks historical state of registration, DNS, hosting, email, and certificates to detect and notify on changes.

### tRPC Routers

#### Tracking Router (`server/routers/tracking.ts`)
Key procedures:
- `addDomain`: Add domain to tracking (or resume unverified). Triggers `auto-verify-pending-domain` Inngest job.
- `verifyDomain`: Verify ownership.
- `removeDomain`: Delete tracked domain.
- `archiveDomain` / `unarchiveDomain`: Soft-archive or reactivate domains.
- `bulkArchiveDomains` / `bulkRemoveDomains`: Bulk operations on multiple domains (parallel execution, max 100).
- `listDomains`: Get all tracked domains for the user (optionally including archived via `includeArchived` parameter).
- `getNotificationPreferences` / `updateGlobalNotificationPreferences`: Global toggles.
- `updateDomainNotificationOverrides` / `resetDomainNotificationOverrides`: Per-domain overrides.

#### User Router (`server/routers/user.ts`)
Key procedures:
- `getSubscription`: Get user's subscription data including tier, active/archived counts, max domains, and `subscriptionEndsAt` for canceled-but-active subscriptions.

### Inngest Background Jobs
- `check-domain-expiry`: Daily at 9:00 AM UTC; sends domain expiration notifications. Uses fan-out pattern (scheduler + worker).
- `check-certificate-expiry`: Daily at 9:15 AM UTC; sends certificate expiration notifications. Uses fan-out pattern (scheduler + worker).
- `check-subscription-expiry`: Daily at 9:30 AM UTC; sends Pro subscription expiry reminders at 7, 3, and 1 days before end. Uses fan-out pattern (scheduler + worker).
- `monitor-tracked-domains`: Every 4 hours; checks for registration, provider, and certificate changes. Uses fan-out pattern (scheduler + worker).
- `reverify-domains`: Twice daily at 4:00 AM and 4:00 PM UTC; auto-verifies pending and re-verifies existing domains. Uses fan-out pattern (scheduler + worker).
- `cleanup-stale-domains`: Weekly on Sundays at 3:00 AM UTC; deletes unverified domains older than 30 days.
- `auto-verify-pending-domain`: Event-driven; auto-verifies newly added domains with smart retry schedule (1m, 3m, 10m, 30m, 1hr).
- `initialize-snapshot`: Event-driven; creates baseline snapshot for newly verified domains (establishes state for change detection).
- `section-revalidate`: Event-driven; background revalidation for individual domain+section combinations with rate limiting and concurrency control.
- `sync-screenshot-blocklist`: Weekly on Sundays at 2:00 AM UTC; syncs external blocklists (e.g., OISD NSFW) to `blocked_domains` table for screenshot/OG image blocking.

## Email Notifications (Resend + React Email)
- **Client:** `lib/resend.ts` exports `resend` client and `RESEND_FROM_EMAIL`.
- **Templates:** `emails/` directory with React Email components:
  - `domain-expiry.tsx` - Domain expiration reminders (30, 14, 7, 1 days before)
  - `certificate-expiry.tsx` - SSL certificate expiration alerts (14, 7, 3, 1 days before)
  - `certificate-change.tsx` - Notifications for SSL certificate changes
  - `provider-change.tsx` - Notifications for DNS/Hosting/Email provider changes
  - `registration-change.tsx` - Notifications for registrar/nameserver/status changes
  - `verification-failing.tsx` - Domain verification started failing (7-day grace period begins)
  - `verification-instructions.tsx` - Instructions for verifying domain ownership
  - `verification-revoked.tsx` - Domain verification revoked (grace period expired)
  - `delete-account-verify.tsx` - Account deletion verification email
  - `pro-upgrade-success.tsx` - Welcome email when Pro subscription becomes active
  - `pro-welcome.tsx` - Tips email sent after Pro upgrade
  - `subscription-canceling.tsx` - Confirmation when subscription is canceled (still active until period end)
  - `subscription-expired.tsx` - Notification when Pro access ends with archived domain count
- **Subscription emails:** `lib/polar/emails.ts` exports `sendProUpgradeEmail()`, `sendSubscriptionCancelingEmail()`, `sendSubscriptionExpiredEmail()`.
- **Idempotency:** Use `generateIdempotencyKey(trackedDomainId, notificationType)` and pass to `resend.emails.send()`.
- **Pattern:** Create notification record → Send email → Update with `resendId` for troubleshooting.
- **Environment variables:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

## Screenshot Blocklist
Screenshots and OG image fetching are blocked for domains on external NSFW/malware blocklists.

### Architecture
- **Database table:** `blocked_domains` stores blocked domain names with primary key lookup for O(1) checks.
- **Repository:** `lib/db/repos/blocked-domains.ts` provides `isDomainBlocked(domain)` for blocking checks and `syncBlockedDomains(domains)` for bulk sync.
- **Edge Config:** `screenshot_blocklist_sources` array of blocklist URLs (e.g., OISD NSFW list).
- **Inngest job:** `sync-screenshot-blocklist` runs weekly to fetch and sync blocklists.

### Integration Points
- **Screenshot service:** `server/services/screenshot.ts` checks blocklist before capturing screenshots.
- **SEO service:** `server/services/seo.ts` checks blocklist before fetching OG images, returns null for blocked domains.

### Sync Behavior
- Upserts new domains (preserves `addedAt` for existing entries).
- Removes stale domains no longer in source lists.
- Skips sync if upstream returns empty (safety against fetch failures).

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

### Dashboard Features
- **Filtering:** URL-persisted filters via `nuqs` (search, health, TLDs, providers). Hook: `hooks/use-dashboard-filters.ts`.
  - Providers filter: Multi-section dropdown showing registrar, DNS, hosting, email, and CA providers with favicons
  - Status filter: Hidden filter only accessible via health summary "pending verification" badge
- **Sorting:** URL-persisted sorting via `nuqs` for both grid and table views. Hook: `hooks/use-dashboard-sort.ts`.
  - Default: Alphabetical by name (domainName.asc)
  - Grid view: Dropdown with preset sort options (domainName.asc, domainName.desc, expirationDate.asc, expirationDate.desc, createdAt.desc)
  - Table view: Column-level sorting that syncs to URL (supports all sortable columns)
  - Format: Uses table column format for all sorts: `?sort=columnId.asc` or `?sort=columnId.desc`
  - View switching: Sort persists when switching between grid/table (falls back to default if table-only sort in grid view)
  - Fully generic: Grid sort options use the same format as table columns (no mapping layer needed)
- **Pagination:** Table view current page stored in URL via `nuqs`, page size stored in localStorage. Hook: `hooks/use-table-pagination.ts`.
  - Format: `?page=2` (1-indexed for user-facing URLs)
  - Page resets to 1 when filters or sort change
  - Page size preference persists across sessions (localStorage)
- **Preferences:** Dashboard UI preferences stored in localStorage. Hook: `hooks/use-dashboard-preferences.ts`.
  - View mode (grid/table) - default: grid
  - Page size (10/25/50/100) - default: 25
  - Consolidated into single localStorage key for efficiency
- **Bulk actions:** Multi-select with floating toolbar for archive/delete. Hook: `hooks/use-selection.ts`. Component: `components/dashboard/bulk-actions-toolbar.tsx`.
- **Health summary:** Clickable badges showing expiring/pending counts. Component: `components/dashboard/health-summary.tsx`.
- **Filter constants:** `lib/constants/domain-filters.ts` defines `HEALTH_OPTIONS` and re-exports `ProviderCategory` from schemas.

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
- Client-side analytics captured via `posthog-js` and initialized in `instrumentation-client.ts`.
- Server-side analytics captured via `posthog-node` in `lib/analytics/server.ts`:
  - Uses `analytics.track()` and `analytics.trackException()` for unified tracking.
  - Leverages Next.js 16 `after()` for background event capture with graceful degradation.
  - Distinct ID sourced from PostHog cookie via `cache()`-wrapped `getDistinctId()` to comply with Next.js restrictions.
- Analytics mocked in tests via `vitest.setup.ts`.

## Structured Logging
- Unified logging system in `lib/logger/` with server (`lib/logger/server.ts`) and client (`lib/logger/client.ts`) implementations.
- **Architecture:**
  - **Shared base:** `BaseLogger` class in `lib/logger/index.ts` provides common overload resolution and formatting logic
  - **Server & Client:** Both extend `BaseLogger` and use native console methods for output
  - Structured JSON output with consistent format across server and client
  - **Important:** OpenTelemetry (OTEL) logging and trace correlation are **intentionally NOT used**. Do not introduce OTEL Logs API, trace/span context, or OTEL instrumentation in future changes.
- **Server-side logging:**
  - Import singleton: `import { logger } from "@/lib/logger/server"`
  - Or create child logger: `const logger = createLogger({ source: "dns" })`
  - Logs output via `console.debug()`, `console.info()`, `console.warn()`, `console.error()` for proper colorization in runtime logs
  - Critical errors automatically tracked in PostHog
  - Log levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`
  - Environment-based log level: configurable via `LOG_LEVEL` env var or defaults (test: warn, dev: debug, prod: info)
- **Client-side logging:**
  - Import singleton: `import { logger } from "@/lib/logger/client"`
  - Or use hook: `const logger = useLogger({ component: "MyComponent" })`
  - Errors automatically tracked in PostHog
  - Development: all levels logged; Production: only errors logged
- **Log format:** Structured JSON with fields: `timestamp` (ISO 8601), `level` (string label), `message`, and context fields merged at root.
- **Usage examples:**
  ```typescript
  // Server (service layer)
  import { createLogger } from "@/lib/logger/server";
  const logger = createLogger({ source: "dns" });
  logger.debug("resolving domain", { domain: "example.com" });
  logger.info("resolution complete", { domain: "example.com", recordCount: 5 });
  logger.error("failed to resolve", error, { domain: "example.com" });

  // Client (components)
  import { useLogger } from "@/hooks/use-logger";
  const logger = useLogger({ component: "DomainSearch" });
  logger.info("search initiated", { domain: query });
  logger.error("search failed", error, { domain: query });
  ```
- **Integration with tRPC:** Middleware in `trpc/init.ts` automatically logs all procedures with structured context.
- **Testing:** Logger mocked in `vitest.setup.ts`. Use `vi.mocked(logger.info)` to assert log calls in tests.
