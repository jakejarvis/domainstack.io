# Repository Guidelines

## Pre-Commit Checklist

**CRITICAL:** Before declaring victory on any task and before committing to git, the following three commands must pass with NO WARNINGS:

1. `pnpm lint` — Must pass with zero warnings
2. `pnpm fmt:check` — Must pass with zero warnings
3. `pnpm test` — Must pass with zero warnings

Do not proceed with commits until all three checks are clean.

<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:
- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

## Commands

### Local development

Runs without OAuth apps or third-party keys (full walkthrough: README "Development"):

1. `docker compose up -d` — Postgres + Upstash-compatible Redis (`compose.yml`)
2. `cp apps/web/.env.example apps/web/.env.local` — the top block points at those services
3. `pnpm db:migrate && pnpm db:seed` — users `free@dev.local` / `pro@dev.local`, password `password123`
4. `pnpm dev`, then use the **Dev sign-in** form at `/login` (exists only when `NODE_ENV=development`)
5. Crons by hand: `curl -H "Authorization: Bearer dev" http://localhost:3000/api/cron/<name>`

Unset services degrade instead of failing (Blob → `apps/web/public/_dev-blob/`, no Redis → no rate limits or monitor locks, no Resend → sends throw). Code that adds a new external service must keep `pnpm dev` working without its credentials (pattern: `packages/blob/src/files.ts`, `getRedis()`) and add a row to the README's optional-services table.

### Development

- `pnpm dev` — Start Next.js dev server at http://localhost:3000
- `pnpm build` — Compile production bundle

### Linting & Formatting

- `pnpm lint` — Run oxlint (includes type-aware linting and type checking)
- `pnpm lint:fix` — Apply oxlint autofixes
- `pnpm fmt` — Apply oxfmt formatting

### Testing

- `pnpm test` — Run all tests once
- `pnpm --filter @domainstack/web test components/foo.test.tsx` — Run specific test files (paths relative to that package; root `pnpm test` is `turbo run test`, which reads extra args as task names)
- `pnpm --filter @domainstack/web test -t "test name"` — Run tests matching a pattern
- `pnpm test:coverage` — Run tests with coverage report (only `apps/web` defines this task; package tests run under `pnpm test`)

### Database

- `pnpm db:generate` — Generate Drizzle migrations
- `pnpm db:push` — Push schema to database
- `pnpm db:migrate` — Apply migrations
- `pnpm db:studio` — Open Drizzle Studio
- `pnpm db:seed` — Seed local dev users and tracked domains (refuses a non-local `DATABASE_URL` unless `pnpm db:seed -- --force`)

Drizzle commands read `DATABASE_URL` from `packages/db/.env`, falling back to `apps/web/.env.local` (`packages/db/drizzle.config.ts`).

## Code Style

### General

- TypeScript only, `strict` enabled
- 2-space indentation (oxfmt enforces)
- Prefer small, pure modules
- Node.js >= 24 required

### Naming Conventions

- **Files/folders:** kebab-case (`user-settings.ts`)
- **React components:** PascalCase exports (`UserSettings`)
- **Helpers/hooks:** camelCase named exports (`useUserSettings`)

### Imports

- Use `@/...` path aliases for app-specific imports
- Import shared UI components from `@domainstack/ui/*` (e.g., `@domainstack/ui/button`)
- oxfmt auto-organizes imports on save
- Client components must start with `"use client"`

### Types

- Shared domain types in `@domainstack/types` package
- Enum const arrays (primitives) in `@domainstack/constants` (Drizzle pgEnums derive from these)
- Do NOT use Zod for simple enums or internal database types
- Import types from `@domainstack/types`

### Tailwind Classes

- oxfmt enforces sorted Tailwind classes via the `sortTailwindcss` option (`.oxfmtrc.json`)
- Use `cn()` from `@domainstack/ui/utils` for conditional classes

## UI work

Before changing UI in `apps/web` or `packages/ui`, follow Vercel's [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) (keyboard, forms, animation, layout, accessibility, performance).

## Error Handling

### Workflow Steps

Errors thrown inside a `"use step"` function decide whether the step retries:

- A plain `Error` retries the step (up to 3 retries by default).
- `RetryableError` (from `workflow`) retries after an explicit `retryAfter` delay.
- `FatalError` (from `workflow`) fails the step without retrying — use it only when a retry cannot succeed.

For database writes, wrap the call in try/catch and `throw classifyDatabaseError(err, { context })` (dynamic `import("../lib/errors")` inside the step): it maps connection, timeout, and deadlock errors to `RetryableError` and constraint or schema errors to `FatalError`. Exemplar: `packages/workflows/src/steps/dns.ts`. When a step is optional and its failure must not fail the run, wrap the call with `optionalCall` (or unwrap `Promise.allSettled` results with `optionalSettled`) from `packages/workflows/src/lib/settled.ts`.

### Custom Error Classes

Domain errors subclass `Error` with a typed `code` (exemplar: `SafeFetchError`, `packages/safe-fetch/src/errors.ts`).

### tRPC Errors

Throw `TRPCError` with a specific code (`UNAUTHORIZED`, `NOT_FOUND`, …).

### Rate Limiting

`protectedProcedure` (`../procedures`) guarantees `ctx.session.user` and runs `withRateLimit` before the resolver (override with `.meta({ rateLimit })`). Public procedures meter inside the resolver: section lookups through `lookupSection`, everything else with `rateLimit`. Code inside `packages/api/src/routers/` imports relatively; the package root exports only `createContext`, `appRouter`, `createCaller`, and the router types.

```typescript
import { lookupSection } from "@domainstack/core/lookup";

import { DomainInputSchema } from "../domain-input";
import { publicProcedure } from "../procedures";
import { rateLimit, rateLimitIdentifier, withTrpcRateLimitErrors } from "../rate-limit";

// Cached section lookups: lookupSection meters only real fetches, so cache hits are free.
getDnsRecords: publicProcedure.input(DomainInputSchema).query(({ ctx, input }) =>
  withTrpcRateLimitErrors(() =>
    lookupSection("dns", input.domain, { identifier: rateLimitIdentifier(ctx) }),
  ),
),

// No cache layer: meter in the resolver.
getThing: publicProcedure.input(DomainInputSchema).query(async ({ ctx, input, path }) => {
  await rateLimit({ ctx, path, config: { requests: 30, window: "1 m" } });
  return fetchThing(input.domain);
}),
```

- Override the default 60/min on protected procedures with `.meta({ rateLimit })`, or skip with `.meta({ rateLimit: false })`
- Identifier is user ID when authenticated, otherwise IP
- Each procedure gets its own bucket (keyed by procedure path)
- On limit exceeded: throws `TOO_MANY_REQUESTS` with retry timing
- Client-side: `rateLimitLink` in tRPC client shows toasts automatically
- For API routes, use `checkRateLimit()` from `@/lib/ratelimit/api`

## Logging

Server-side only using Pino (object-first API): `const logger = createLogger({ source: "dns" })` from `@domainstack/logger`, then `logger.info({ domain, count }, "resolution complete")` / `logger.error({ err, domain }, "failed to resolve")`.

Client-side: call `posthogClient.captureException(error, context)` (`import posthogClient from "posthog-js";`, e.g. `apps/web/components/chat/chat-client.tsx`) for errors.

## Testing Patterns

### File Organization

- Node tests: `**/*.test.ts` (run in Node environment)
- Browser tests: `**/*.test.tsx` (run in Playwright browser)
- Tests live next to the code they test. Exception: `@domainstack/db` has no test runner, so tests for its queries live in the consuming package (e.g. `packages/polar/src/user-subscription.test.ts`, `packages/core/src/dns/replace-dns.test.ts`)
- Browser tests use `vitest-browser-react` and locators from `vitest/browser`. Render through `@/mocks/react`, query with `page.getBy*`, interact with locator actions (`click()`, `fill()`, `hover()`), and assert with `await expect.element(...)`. Do not use Testing Library.

### Mocking

- The logger is mocked in each package's vitest setup (`apps/web/vitest.setup.node.ts`, `packages/api/vitest.setup.ts`, `packages/workflows/vitest.setup.ts`) via `@domainstack/logger/testing`; Redis and the rate limiter via `@domainstack/redis/testing` (web and api); analytics in the web (`@domainstack/api/analytics`) and api (`./src/analytics`) setups; `posthog-js` in `apps/web/vitest.setup.browser.ts`
- Use `vi.hoisted` for ESM module mocks
- Use PGlite for isolated database testing: `makePGliteDb` / `closePGliteDb`
  from `@domainstack/db/testing`. Initialize the DB *before* importing any
  module that uses it — see `packages/polar/src/user-subscription.test.ts`
  for the required dynamic-import ordering.
- Storage tests mock `files-sdk/vercel-blob` (`packages/blob/src/files.test.ts`); services that store images mock `@domainstack/image` (e.g. `packages/core/src/favicon/index.test.ts`)

## Project Structure

This is a **Turborepo monorepo** with the following structure:

```
domainstack.io/
├── apps/
│   └── web/                    # Next.js application (@domainstack/web)
│       ├── app/                # Next.js App Router
│       ├── components/         # App-specific components
│       │   └── ui/             # App-specific UI wrappers (Next.js-aware)
│       ├── context/            # React contexts (dashboard)
│       ├── hooks/              # App-specific React hooks
│       ├── lib/                # App-local utilities (atoms, stores, chat, ratelimit)
│       ├── mocks/              # Test doubles (tRPC, MSW server, next/*)
│       └── trpc/               # tRPC client setup + the RSC headers() context wrapper
├── packages/
│   ├── api/                    # tRPC init, procedures, middleware, routers, appRouter (@domainstack/api)
│   ├── auth/                   # Better Auth server/client config
│   ├── blob/                   # Blob storage (files-sdk over Vercel Blob; disk fallback in dev) + HMAC keys
│   ├── constants/               # Shared constants; primitives/ holds enum arrays
│   ├── core/                    # Domain data services (@domainstack/core), one folder per data source
│   │   └── src/                 #   one folder per data source; `index.ts` is its persisting service
│   │                            #   (dns/ headers/ tls/ seo/ whois/ also keep low-level fetch/parse files beside it)
│   │                            #   hosting/ favicon/ provider-logo/ pricing/ verification/
│   │                            #   lookup/ (cache → rate limit → fetch orchestrator), lib/ (ttl, cloudflare, in-flight, fetch-errors)
│   ├── db/                     # Drizzle schema, client, and query layer
│   │   └── scripts/seed.ts     # `pnpm db:seed` dev data
│   ├── edge-config/             # Vercel Global Config reader (provider catalog)
│   ├── email/                  # React Email templates + Resend
│   ├── image/                   # Favicon/logo processing (sharp)
│   ├── logger/                  # Pino logger factory
│   ├── polar/                   # Polar billing SDK, webhooks, reconciliation
│   ├── redis/                   # Upstash Redis client + rate limiter
│   ├── safe-fetch/               # SSRF-hardened fetch (DNS pinning, private-IP blocks)
│   ├── screenshot/              # Puppeteer screenshot capture
│   ├── types/                  # Shared TypeScript types (@domainstack/types)
│   │   └── src/
│   │       └── domain/         # Domain-related types (DNS, certs, headers, etc.)
│   ├── typescript-config/       # Shared tsconfig bases
│   ├── ui/                     # Shared UI component library (@domainstack/ui)
│   │   └── src/
│   │       ├── components/     # Framework-agnostic UI primitives
│   │       ├── hooks/          # Shared React hooks
│   │       └── utils.ts        # cn()
│   ├── utils/                   # Pure helpers shared by 2+ packages: dates, domains, DNS records, providers
│   └── workflows/               # Every "use workflow"/"use step" but chat (@domainstack/workflows)
│       └── src/
│           ├── <name>/         # one folder per workflow (`workflow.ts` + its own steps)
│           ├── steps/          # Shared step wrappers (dns, headers, certificates, hosting, registration, …)
│           └── lib/            # Non-step code shared by 2+ workflows: change-detection.ts, errors.ts (classifyDatabaseError), monitor-lock.ts, settled.ts
├── compose.yml                 # Local Postgres + Upstash-compatible Redis for `pnpm dev`
├── turbo.json                  # Turborepo task configuration
├── pnpm-workspace.yaml         # pnpm workspace definition
└── package.json                # Root workspace config
```

All commands run from the **monorepo root** via Turborepo.

### Package boundaries

The backend is layered strictly one-way: `apps/web` → `@domainstack/api` → `@domainstack/workflows` → `@domainstack/core` → `db`, `redis`, `safe-fetch`, `edge-config`, `image`, `utils`, etc. (`api` may also call `core` directly. `apps/web` route handlers, chat tools and the MCP route also read `db/queries` and call `core` directly, and its cron/screenshot routes call `start()` on workflows.)

1. **`@domainstack/core`**: plain async domain services (fetch, normalize, persist). Never imports `workflow`, `@trpc/*`, or `next/*`.
2. **`@domainstack/workflows`**: every `"use workflow"`/`"use step"` function except chat, plus the step wrappers and workflow infrastructure. Never imports `@trpc/*`, `next/*`, or `@domainstack/api`.
3. **`@domainstack/api`**: tRPC init, middleware, all routers, `appRouter`, `AppRouter`, `RouterInputs`/`RouterOutputs`, `createCaller`. May `start()` workflows directly, no dependency injection. No `next/*` imports.
4. **`apps/web`**: route handlers, the RSC context wrapper (`trpc/init.ts`), UI, and the chat workflow (the one exception that stays in the Next app).
5. No package cycles. Subpath `exports` point straight at implementation files; don't add new barrel files (a few package roots already aggregate re-exports — don't grow them).
6. Code lives with its only consumer. `@domainstack/utils` holds pure helpers (no network I/O) used by two or more packages. Within `@domainstack/workflows`, code used by one workflow sits in that workflow's folder; code shared by two or more workflows goes in `lib/` (or `steps/` when it is a step). Exception: tested helpers stay out of `@domainstack/db`, which has no test runner.

### Package Imports

**Database** (`@domainstack/db`): subpath imports, e.g. `import { db } from "@domainstack/db/client"`, `import { domains } from "@domainstack/db/schema"`, `import { getCachedRegistration } from "@domainstack/db/queries/registrations"`. All database access goes through `packages/db/src/queries/*` — do not write Drizzle queries directly in `apps/web`. Cached read functions are named `getCached*` and return `CacheResult<T>` with staleness metadata.

**Domain services** (`@domainstack/core`):

```typescript
import { lookupSection } from "@domainstack/core/lookup"; // cache → rate limit → fetch; used by tRPC, chat, and MCP
import { fetchDns } from "@domainstack/core/dns";
import { fetchRegistration } from "@domainstack/core/whois";
```

Outbound domain lookups (DNS, TLS, WHOIS/RDAP, SEO, headers) live here, not in
`apps/web`. They already handle caching, retries, and SSRF-safe fetching.

**UI Components** (`@domainstack/ui`): one subpath per component, e.g. `import { Button } from "@domainstack/ui/button"`, `import { cn } from "@domainstack/ui/utils"`, `import { useMediaQuery } from "@domainstack/ui/hooks"`.

**App-specific wrappers** (in `apps/web/components/ui/`):

- `sonner.tsx` — Configures toast notifications with theme support and custom icons
- `map.tsx` — MapLibre GL map primitives (map instance, markers, popups, route lines)

## Key Patterns

### SWR Caching

Repository functions return `CacheResult<T>` (`{ data, stale, … }`, e.g. `getCachedRegistration`); `stale` means the caller should revalidate. `lookupSection` (`@domainstack/core/lookup`) serves only fresh cache and refetches otherwise; there is no serve-stale path yet.

### Workflow Concurrency

The `monitor-domains` cron (every 30 minutes, `apps/web/vercel.json`) must not start a second `detectChangesWorkflow`
for a domain whose previous run is still in flight. Use the per-domain Redis lock
in `@domainstack/workflows/monitor-lock`:

```typescript
import { start } from "workflow/api";

import { detectChangesWorkflow } from "@domainstack/workflows/detect-changes";
import { acquireMonitorLock, releaseMonitorLock } from "@domainstack/workflows/monitor-lock";

const ownerToken = await acquireMonitorLock(trackedDomainId);
if (!ownerToken) {
  // Another run holds the lock — skip this domain this tick.
  return;
}
try {
  // The workflow releases the lock itself when it finishes.
  await start(detectChangesWorkflow, [{ trackedDomainId, monitorLockOwnerToken: ownerToken }]);
} catch (err) {
  await releaseMonitorLock(trackedDomainId, ownerToken);
  throw err;
}
```

The lock is acquired by the cron and released by the workflow when it finishes
(including on a fatal error), or by the cron if `start()` itself throws. It fails
open: if Redis is unconfigured or unreachable, work proceeds without dedup rather
than halting monitoring. Release is an owner-token compare-and-delete, so a run
can never release a lock it does not hold.

### Optimistic Updates (TanStack Query)

Mutations update the cache optimistically and roll back on error — follow `apps/web/hooks/use-dashboard-mutations.ts`.

### Suspense with TanStack Query

Use `useSuspenseQuery` inside `ErrorBoundary` + `Suspense` for declarative data fetching. Exemplar: `apps/web/components/domain/report-client.tsx`.

- Use for: simple read-only queries without `enabled`, components that render data immediately, parallel independent sections (`useSuspenseQueries`)
- Don't use for: queries with `enabled`, hooks with mutations and optimistic updates (e.g. `useDashboardMutations`), lazy-loaded data (hover triggers, infinite scroll), polling
- Error boundaries: `SectionErrorBoundary` (domain report sections), `SettingsErrorBoundary` (settings panels); build context-specific ones with `CreateIssueButton`
- Skeletons mirror final layout to prevent CLS; export them (e.g. `CalendarInstructionsSkeleton`)

## AI Chat

The AI chat assistant (`apps/web/components/chat/`) provides natural language domain lookups using Vercel's Workflow SDK.

### Architecture

- **Client**: `useChat` (`@ai-sdk/react`) + `WorkflowChatTransport` (`@ai-sdk/workflow/client`) with Zustand session persistence (`apps/web/lib/stores/chat-store.ts`)
- **API**: `POST /api/chat` starts workflow, returns streaming response; `GET /api/chat/:runId/stream` reconnects
- **Workflow**: `apps/web/lib/chat/workflow.ts` uses `WorkflowAgent` from `@ai-sdk/workflow` for durable tool execution
- **Tools**: `apps/web/lib/chat/tools.ts` defines domain lookup tools (WHOIS, DNS, SSL, etc.)
- **Local mode**: `hooks/use-local-chat.ts` runs the same tools in the browser with on-device AI (`hooks/use-browser-ai.ts`, `lib/chat/client-tools.ts`)

### Constants (`packages/constants/src/ai.ts`)

All chat limits are centralized for client/server consistency.

- **Rate limits**: `RATE_LIMIT_ANONYMOUS` / `RATE_LIMIT_AUTHENTICATED` (from the module above), enforced in `app/api/chat/route.ts` via `checkRateLimit`
- **Defenses**: per-user/IP rate limits, Zod-validated messages, history truncation, and a system prompt that refuses off-topic or override requests

### Adding New Tools

1. Add the tool's `name`, `section`, `status` label, and `description` to `DOMAIN_TOOL_DEFS` in `apps/web/lib/chat/domain-tools.ts`; `createDomainToolset()` (`tools.ts`) and the browser client tools build from it
2. Mention the tool in the system prompt (`apps/web/lib/chat/system-prompt.ts`) if the model needs guidance on when to call it
3. Tools call `lookupSection` from `@domainstack/core/lookup`, which applies the same per-section cache and rate limits as the tRPC domain procedures
