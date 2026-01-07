# Repository Guidelines

## Project Structure & Module Organization
- `app/` Next.js App Router. Default to server components; keep `app/page.tsx` and `app/api/*` thin and delegate to `server/` or `lib/`.
- `app/dashboard/` Protected dashboard for domain tracking with Active/Archived tabs.
- `app/bookmarklet/` Bookmarklet installation and standalone pages.
- `app/@modal/` Intercepting routes for modal dialogs (`(.)login`, `(.)dashboard`, `(.)settings`, `(.)bookmarklet`).
- `components/` reusable UI primitives (kebab-case files, PascalCase exports).
- `components/auth/` Authentication components (sign-in button, user menu, login content).
- `components/dashboard/` Dashboard components (grid cards, grid/table views, add domain dialog, upgrade prompt, archived domains view, bulk actions toolbar, filters, health summary, domain status badges, provider tooltips).
- `components/settings/` Settings page components (subscription section, notification settings, linked accounts, calendar feed, danger zone/account deletion).
- `emails/` React Email templates for notifications (domain expiry, certificate expiry, verification status, subscription lifecycle).
- `hooks/` shared stateful helpers (camelCase named exports): `useAuthCallback`, `useDashboardFilters`, `useDashboardPagination`, `useDashboardPreferences`, `useDashboardSelection`, `useDashboardSort`, `useDomainHistory`, `useDomainSearch`, `useDomainVerification`, `useIsMac`, `useMediaQuery`, `useMobile`, `useNotificationMutations`, `usePointerCapability`, `useProgressiveReveal`, `useProviderTooltipData`, `useReportExport`, `useReportSectionObserver`, `useRouter`, `useSubscription`, `useTheme`, `useTrackedDomains`, `useTruncation`.
- `lib/` domain utilities and shared modules; import via `@/...` aliases.
- `lib/auth.ts` better-auth server configuration with Drizzle adapter.
- `lib/auth-client.ts` better-auth client for React hooks (`useSession`, `signIn`, `signOut`).
- `lib/constants/` modular constants organized by domain (app, auth-errors, decay, domain-filters, domain-validation, email, gdpr, headers, notifications, oauth-providers, plan-quotas, pricing-providers, sections, ttl, verification).
- `lib/dns-utils.ts` shared DNS over HTTPS (DoH) utilities: provider list, header constants, URL builder, and deterministic provider ordering for cache consistency.
- `lib/inngest/` Inngest client and functions for background jobs. Uses fan-out pattern with separate `scheduler` and `worker` functions for scalability.
- `lib/db/` Drizzle ORM schema, migrations, and repository layer for Postgres persistence.
- `lib/db/repos/` repository layer for each table (blocked-domains, calendar-feeds, domains, certificates, dns, favicons, headers, hosting, notifications, providers, provider-logos, registrations, screenshots, seo, snapshots, stats, tracked-domains, user-notification-preferences, user-subscription, users).
- `lib/logger/` Pino-based server-side logging system with JSON output in production and pretty-printing in development.
- `lib/polar/` Polar subscription integration (products config, webhook handlers, downgrade logic, subscription emails).
- `lib/calendar/` iCalendar feed generation for domain expirations (uses `ical-generator`).
- `lib/resend.ts` Resend email client for sending notifications.
- `lib/providers/` provider detection system with rule syntax and Edge Config catalog parsing.
- `lib/types/` Plain TypeScript types - single source of truth for enums and internal data structures.
- `server/` backend integrations and tRPC routers; isolate DNS, RDAP/WHOIS, TLS, and header probing services.
- `server/routers/` tRPC router definitions (`_app.ts`, `domain.ts`, `notifications.ts`, `provider.ts`, `registrar.ts`, `stats.ts`, `tracking.ts`, `user.ts`).
- `server/services/` service layer for orchestration (currently empty - all services migrated to workflows).
- `lib/geoip.ts` IP metadata lookup (geolocation, ownership) via ipwho.is API.
- `lib/pricing.ts` Domain registration pricing aggregation from multiple registrars (Porkbun, Cloudflare, Dynadot).
- `public/` static assets; Tailwind v4 tokens live in `app/globals.css`. Update `instrumentation-client.ts` when adding analytics.
- `trpc/` tRPC client setup, query client, error handling, and `protectedProcedure` for auth-required endpoints.
- `workflows/` Vercel Workflow definitions for durable backend operations. See the "Available Workflows" table below.

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
- Constants: Organize by domain in `lib/constants/` submodules.
- Types and Schemas:
  - **Plain TypeScript** (`lib/types/`): Use for internal data structures that don't need runtime validation. Simple enums are defined as `const` arrays with derived union types.
  - **Single source of truth**: Enum const arrays live in `lib/types/primitives.ts`. Drizzle pgEnums derive from these arrays.
  - **Importing types**: Prefer `@/lib/types` for types.
  - Do NOT use Zod for simple enums or internal data structures from your own database.

## Testing Guidelines
- Use **Vitest** with **Browser Mode** (Playwright) for component testing; config in `vitest.config.ts`.
- Uses `threads` pool for compatibility with sandboxed environments (e.g., Cursor agent commands).
- Global setup:
  - `vitest.setup.node.ts` for Node environment tests (services, utils).
  - `vitest.setup.browser.ts` for Browser environment tests (components).
  - Mocks analytics clients/servers (`@/lib/analytics/server` and `@/lib/analytics/client`).
  - Mocks server logger (`@/lib/logger/server`).
  - Mocks `server-only` module.
- Database in tests: Drizzle client is not globally mocked. Replace `@/lib/db/client` with a PGlite-backed instance when needed (`@/lib/db/pglite`).
- UI tests:
  - Do not add direct tests for `components/ui/*` (shadcn).
  - Mock tRPC/React Query for components like `Favicon` and `Screenshot`.
- Server tests:
  - Prefer `vi.hoisted` for ESM module mocks (e.g., `node:tls`).
  - Vercel Blob storage: mock `@vercel/blob` (`put` and `del` functions). Set `BLOB_READ_WRITE_TOKEN` via `vi.stubEnv` in suites that touch uploads/deletes.
  - Repository tests (`lib/db/repos/*.test.ts`): Use PGlite for isolated in-memory database testing.
- Workflow tests (`workflows/*/workflow.test.ts`):
  - Test step functions directly by mocking their dependencies (dynamic imports).
  - Use PGlite for database-backed tests, mock external services (`@/lib/storage`, `@/lib/fetch-remote-asset`).
  - For steps with dynamic imports (Puppeteer, TLS), focus on cache and blocklist tests; integration tests cover the full flow.
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
  - `provider_catalog` (object): Provider detection rules for CA, DNS, email, hosting, and registrar providers. Structure: `{ ca: [...], dns: [...], email: [...], hosting: [...], registrar: [...] }`. Providers are lazily inserted into the database on first detection.
  - `screenshot_blocklist_sources` (array): URLs of external blocklists (e.g., OISD NSFW) for screenshot/OG image blocking; fails gracefully to empty array (allows all domains)
- Free vs Pro quotas are defined in `lib/constants/plan-quotas.ts`.
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

Verification workflow: `workflows/verification/` with durable steps for DNS TXT, HTML file, and meta tag verification. Uses shared DoH utilities from `lib/dns-utils.ts` for redundant DNS verification across multiple providers (Cloudflare, Google).

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
- `getSubscription`: Get user's subscription data including tier, active/archived counts, max domains, and `endsAt` for canceled-but-active subscriptions.
- `getCalendarFeed` / `enableCalendarFeed` / `disableCalendarFeed`: Manage calendar feed subscription.
- `rotateCalendarFeedToken`: Generate a new calendar URL (invalidates old URL).
- `deleteCalendarFeed`: Completely remove calendar feed.

### Calendar Feed
Users can subscribe to domain expiration dates via iCalendar feed compatible with Google Calendar, Apple Calendar, Outlook, etc.

**Architecture:**
- **Database table:** `calendar_feeds` stores per-user feed tokens with enable/disable state and access tracking.
- **Repository:** `lib/db/repos/calendar-feeds.ts` provides token generation, validation, and CRUD operations.
- **Generator:** `lib/calendar/generate.ts` creates iCalendar content using `ical-generator` library.
- **API endpoint:** `GET /api/calendar/user?token=...` (public-friendly URL: `/dashboard/feed.ics?token=...` via rewrite).
- **UI component:** `components/settings/calendar-feed-section.tsx` in settings page.

**Key features:**
- Token-based authentication (capability URL pattern) - no session required.
- All-day events for domain expirations (date-focused, timezone-agnostic).
- ETag/If-None-Match support for efficient caching (304 Not Modified).
- Access tracking: `lastAccessedAt` and `accessCount` updated on each fetch.
- Token rotation for security (generates new URL, invalidates old one).
- Enable/disable without losing token (can re-enable later).

**Security considerations:**
- Tokens are 32-byte base64url (~43 chars) for cryptographic security.
- Same error message for "not found" and "disabled" to prevent enumeration.
- UI warns users to treat feed URL as a password.

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

### Workflow DevKit (Durable Workflows)
Vercel's Workflow DevKit provides durable execution for heavy backend operations. Unlike Inngest (scheduled/event-driven jobs), Workflow is designed for long-running, resource-intensive operations that benefit from step-by-step durability and automatic retries.

**Architecture:**
- **Config:** `next.config.ts` wrapped with `withWorkflow()` for directive support.
- **Instrumentation:** `instrumentation.ts` initializes the workflow world on server startup.
- **Workflows:** `workflows/` directory contains workflow definitions.
- **Steps:** Functions marked with `"use step"` directive run as durable, retryable steps.
- **Integration:** tRPC procedures in `server/routers/domain.ts` and `server/routers/provider.ts` call workflows via `start()` and await `run.returnValue`.

**Available Workflows:**

| Workflow | Input | Purpose | Steps |
|----------|-------|---------|-------|
| `certificatesWorkflow` | `{ domain }` | Fetch SSL/TLS certificate chain | checkCache → fetchCertificateChain → detectProvidersAndBuildResponse → persistCertificates |
| `dnsWorkflow` | `{ domain }` | Resolve DNS records via DoH | checkCache → fetchFromProviders → persistRecords |
| `faviconWorkflow` | `{ domain }` | Extract domain favicon | checkCache → fetchFromSources → processImage → storeAndPersist / persistFailure |
| `headersWorkflow` | `{ domain }` | Probe HTTP headers | checkCache → fetchHeaders → persistHeaders |
| `hostingWorkflow` | `{ domain, dnsRecords, headers }` | Detect hosting/email/DNS providers | lookupGeoIp → detectAndResolveProviders → persistHosting |
| `providerLogoWorkflow` | `{ providerId, providerDomain }` | Extract provider logo | checkCache → fetchFromSources → processImage → storeAndPersist / persistFailure |
| `registrationWorkflow` | `{ domain }` | WHOIS/RDAP lookup | checkCache → lookupRdap → normalizeAndBuildResponse → persistRegistration |
| `screenshotWorkflow` | `{ domain }` | Capture domain screenshot | checkBlocklist → checkCache → captureScreenshot → storeScreenshot → persistSuccess/persistFailure |
| `seoWorkflow` | `{ domain }` | Fetch SEO meta and robots.txt | checkCache → fetchHtml → fetchRobots → processOgImage → persistSeo |
| `verificationWorkflow` | `{ domain, token, method? }` | Verify domain ownership | verifyByDns → verifyByHtmlFile → verifyByMetaTag (or single method if specified) |

**Usage Pattern:**
```typescript
import { start } from "workflow/api";
import { registrationWorkflow } from "@/workflows/registration";

// Start workflow and wait for result
const run = await start(registrationWorkflow, [{ domain: "example.com" }]);
const result = await run.returnValue;
```

**When to use Workflow vs Inngest:**
- **Workflow:** Heavy, request-triggered operations that need durability (screenshots, TLS handshakes, RDAP lookups, DNS resolution, SEO data fetching)
- **Inngest:** Scheduled jobs, event-driven background tasks, fan-out patterns, multi-domain batch operations

**Observability:**
```bash
# Open the workflow Web UI
npx workflow web
# CLI inspection
npx workflow inspect runs
```

**Reference**
[Workflow DevKit docs](https://useworkflow.dev/llms.txt)

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
- **Screenshot workflow:** `workflows/screenshot/workflow.ts` checks blocklist in `checkBlocklist` step before capturing.
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
  - `handleSubscriptionCanceled` - stores `endsAt` to show banner (user keeps access until period ends)
  - `handleSubscriptionRevoked` - triggers downgrade and clears `endsAt`
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
- Server-only logging system using **Pino** (`lib/logger/server.ts`). No client-side logging.
- **Architecture:**
  - **Pino-based:** High-performance, low-overhead JSON logger for Node.js
  - **Server-only:** Client-side errors are tracked via `analytics.trackException()` (PostHog)
  - Structured JSON output in production; pretty-printed with colors in development via `pino-pretty`
  - **OTel trace correlation:** Logs automatically include `traceId` and `spanId` from Vercel's OpenTelemetry context via `@opentelemetry/instrumentation-pino`, enabling request tracing in Vercel's Observability dashboard.
- **Server-side logging:**
  - Import singleton: `import { logger } from "@/lib/logger/server"`
  - Or create child logger: `const logger = createLogger({ source: "dns" })`
  - Uses Pino's object-first API: context object as first argument, message as second
  - Critical errors (`error`, `fatal`) automatically tracked in PostHog
  - Log levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`
  - Environment-based log level: configurable via `LOG_LEVEL` env var (default: info)
- **Client-side error tracking:**
  - No client-side logger. Use `analytics.trackException(error, context)` for error tracking
  - Error boundaries use `analytics.trackException()` directly
  - User-facing errors should use `toast.error()` from sonner
- **Log format (Pino object-first API):**
  ```typescript
  // Context object first, message string second
  logger.info({ domain: "example.com" }, "resolving domain");
  logger.error({ err, domain: "example.com" }, "failed to resolve");
  
  // NOT the old message-first API:
  // logger.info("resolving domain", { domain: "example.com" }); // WRONG
  ```
- **Usage examples:**
  ```typescript
  // Server (service layer)
  import { createLogger } from "@/lib/logger/server";
  const logger = createLogger({ source: "dns" });
  logger.debug({ domain: "example.com" }, "resolving domain");
  logger.info({ domain: "example.com", recordCount: 5 }, "resolution complete");
  logger.error({ err: error, domain: "example.com" }, "failed to resolve");

  // Client (error boundaries)
  import { analytics } from "@/lib/analytics/client";
  analytics.trackException(error, { source: "RootErrorBoundary" });
  ```
- **Integration with tRPC:** Middleware in `trpc/init.ts` automatically logs all procedures with structured context.
- **Testing:** Logger mocked in `vitest.setup.node.ts`. Use `vi.mocked(logger.info)` to assert log calls in tests.
