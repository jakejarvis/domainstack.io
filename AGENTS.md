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

### Development

- `pnpm dev` — Start Next.js dev server at http://localhost:3000
- `pnpm build` — Compile production bundle

### Linting & Formatting

- `pnpm lint` — Run oxlint (includes type-aware linting and type checking)
- `pnpm fmt` — Apply oxfmt formatting

### Testing

- `pnpm test` — Run all tests once
- `pnpm test path/to/file.test.ts` — Run a single test file
- `pnpm test -t "test name"` — Run tests matching a pattern
- `pnpm test:coverage` — Run tests with coverage report

### Database

- `pnpm db:generate` — Generate Drizzle migrations
- `pnpm db:push` — Push schema to database
- `pnpm db:migrate` — Apply migrations
- `pnpm db:studio` — Open Drizzle Studio

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

- oxfmt enforces sorted Tailwind classes via `useSortedClasses` rule
- Use `cn()` from `@domainstack/ui/utils` for conditional classes

## Web Interface Guidelines

Concise rules for building accessible, fast, delightful UIs. Use MUST/SHOULD/NEVER to guide decisions.

### Interactions

#### Keyboard

- MUST: Full keyboard support per [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/)
- MUST: Visible focus rings (`:focus-visible`; group with `:focus-within`)
- MUST: Manage focus (trap, move, return) per APG patterns
- NEVER: `outline: none` without visible focus replacement

#### Targets & Input

- MUST: Hit target ≥24px (mobile ≥44px); if visual <24px, expand hit area
- MUST: Mobile `<input>` font-size ≥16px to prevent iOS zoom
- NEVER: Disable browser zoom (`user-scalable=no`, `maximum-scale=1`)
- MUST: `touch-action: manipulation` to prevent double-tap zoom
- SHOULD: Set `-webkit-tap-highlight-color` to match design

#### Forms

- MUST: Hydration-safe inputs (no lost focus/value)
- NEVER: Block paste in `<input>`/`<textarea>`
- MUST: Loading buttons show spinner and keep original label
- MUST: Enter submits focused input; in `<textarea>`, ⌘/Ctrl+Enter submits
- MUST: Keep submit enabled until request starts; then disable with spinner
- MUST: Accept free text, validate after—don't block typing
- MUST: Allow incomplete form submission to surface validation
- MUST: Errors inline next to fields; on submit, focus first error
- MUST: `autocomplete` + meaningful `name`; correct `type` and `inputmode`
- SHOULD: Disable spellcheck for emails/codes/usernames
- SHOULD: Placeholders end with `…` and show example pattern
- MUST: Warn on unsaved changes before navigation
- MUST: Compatible with password managers & 2FA; allow pasting codes
- MUST: Trim values to handle text expansion trailing spaces
- MUST: No dead zones on checkboxes/radios; label+control share one hit target

#### State & Navigation

- MUST: URL reflects state (deep-link filters/tabs/pagination/expanded panels)
- MUST: Back/Forward restores scroll position
- MUST: Links use `<a>`/`<Link>` for navigation (support Cmd/Ctrl/middle-click)
- NEVER: Use `<div onClick>` for navigation

#### Feedback

- SHOULD: Optimistic UI; reconcile on response; on failure rollback or offer Undo
- MUST: Confirm destructive actions or provide Undo window
- MUST: Use polite `aria-live` for toasts/inline validation
- SHOULD: Ellipsis (`…`) for options opening follow-ups ("Rename…") and loading states ("Loading…")

#### Touch & Drag

- MUST: Generous targets, clear affordances; avoid finicky interactions
- MUST: Delay first tooltip; subsequent peers instant
- MUST: `overscroll-behavior: contain` in modals/drawers
- MUST: During drag, disable text selection and set `inert` on dragged elements
- MUST: If it looks clickable, it must be clickable

#### Autofocus

- SHOULD: Autofocus on desktop with single primary input; rarely on mobile

### Animation

- MUST: Honor `prefers-reduced-motion` (provide reduced variant or disable)
- SHOULD: Prefer CSS > Web Animations API > JS libraries
- MUST: Animate compositor-friendly props (`transform`, `opacity`) only
- NEVER: Animate layout props (`top`, `left`, `width`, `height`)
- NEVER: `transition: all`—list properties explicitly
- SHOULD: Animate only to clarify cause/effect or add deliberate delight
- SHOULD: Choose easing to match the change (size/distance/trigger)
- MUST: Animations interruptible and input-driven (no autoplay)
- MUST: Correct `transform-origin` (motion starts where it "physically" should)
- MUST: SVG transforms on `<g>` wrapper with `transform-box: fill-box`

### Layout

- SHOULD: Optical alignment; adjust ±1px when perception beats geometry
- MUST: Deliberate alignment to grid/baseline/edges—no accidental placement
- SHOULD: Balance icon/text lockups (weight/size/spacing/color)
- MUST: Verify mobile, laptop, ultra-wide (simulate ultra-wide at 50% zoom)
- MUST: Respect safe areas (`env(safe-area-inset-*)`)
- MUST: Avoid unwanted scrollbars; fix overflows
- SHOULD: Flex/grid over JS measurement for layout

### Content & Accessibility

- SHOULD: Inline help first; tooltips last resort
- MUST: Skeletons mirror final content to avoid layout shift
- MUST: `<title>` matches current context
- MUST: No dead ends; always offer next step/recovery
- MUST: Design empty/sparse/dense/error states
- SHOULD: Curly quotes (" "); avoid widows/orphans (`text-wrap: balance`)
- MUST: `font-variant-numeric: tabular-nums` for number comparisons
- MUST: Redundant status cues (not color-only); icons have text labels
- MUST: Accessible names exist even when visuals omit labels
- MUST: Use `…` character (not `...`)
- MUST: `scroll-margin-top` on headings; "Skip to content" link; hierarchical `<h1>`–`<h6>`
- MUST: Resilient to user-generated content (short/avg/very long)
- MUST: Locale-aware dates/times/numbers (`Intl.DateTimeFormat`, `Intl.NumberFormat`)
- MUST: Accurate `aria-label`; decorative elements `aria-hidden`
- MUST: Icon-only buttons have descriptive `aria-label`
- MUST: Prefer native semantics (`button`, `a`, `label`, `table`) before ARIA
- MUST: Non-breaking spaces: `10&nbsp;MB`, `⌘&nbsp;K`, brand names

### Content Handling

- MUST: Text containers handle long content (`truncate`, `line-clamp-*`, `break-words`)
- MUST: Flex children need `min-w-0` to allow truncation
- MUST: Handle empty states—no broken UI for empty strings/arrays

### Performance

- SHOULD: Test iOS Low Power Mode and macOS Safari
- MUST: Measure reliably (disable extensions that skew runtime)
- MUST: Track and minimize re-renders (React DevTools/React Scan)
- MUST: Profile with CPU/network throttling
- MUST: Batch layout reads/writes; avoid reflows/repaints
- MUST: Mutations (`POST`/`PATCH`/`DELETE`) target <500ms
- SHOULD: Prefer uncontrolled inputs; controlled inputs cheap per keystroke
- MUST: Virtualize large lists (>50 items)
- MUST: Preload above-fold images; lazy-load the rest
- MUST: Prevent CLS (explicit image dimensions)
- SHOULD: `<link rel="preconnect">` for CDN domains
- SHOULD: Critical fonts: `<link rel="preload" as="font">` with `font-display: swap`

### Dark Mode & Theming

- MUST: `color-scheme: dark` on `<html>` for dark themes
- SHOULD: `<meta name="theme-color">` matches page background
- MUST: Native `<select>`: explicit `background-color` and `color` (Windows fix)

### Hydration

- MUST: Inputs with `value` need `onChange` (or use `defaultValue`)
- SHOULD: Guard date/time rendering against hydration mismatch

### Design

- SHOULD: Layered shadows (ambient + direct)
- SHOULD: Crisp edges via semi-transparent borders + shadows
- SHOULD: Nested radii: child ≤ parent; concentric
- SHOULD: Hue consistency: tint borders/shadows/text toward bg hue
- MUST: Accessible charts (color-blind-friendly palettes)
- MUST: Meet contrast—prefer [APCA](https://apcacontrast.com/) over WCAG 2
- MUST: Increase contrast on `:hover`/`:active`/`:focus`
- SHOULD: Match browser UI to bg
- SHOULD: Avoid gradient banding (use masks when needed)

## Error Handling

### Workflow Steps

Errors thrown inside a `"use step"` function decide whether the step retries:

- A plain `Error` retries the step (up to 3 retries by default).
- `RetryableError` (from `workflow`) retries after an explicit `retryAfter` delay.
- `FatalError` (from `workflow`) fails the step without retrying — use it only when a retry cannot succeed.

For database writes, `classifyDatabaseError` maps connection, timeout, and deadlock errors to `RetryableError` and constraint or schema errors to `FatalError`:

```typescript
async function persistDataStep(domain: string, data: Data): Promise<void> {
  "use step";
  try {
    await persistData(domain, data);
  } catch (err) {
    const { classifyDatabaseError } = await import("../lib/errors");
    throw classifyDatabaseError(err, { context: `persisting data for ${domain}` });
  }
}
```

Exemplar: `packages/workflows/src/steps/dns.ts`. When a step is optional and its failure must not fail the run, wrap the call with `optionalCall` (or unwrap `Promise.allSettled` results with `optionalSettled`) from `packages/workflows/src/lib/settled.ts`.

### Custom Error Classes

Create domain-specific errors with typed codes:

```typescript
export class SafeFetchError extends Error {
  constructor(
    public readonly code: SafeFetchErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}
```

### tRPC Errors

Use `TRPCError` with appropriate codes:

```typescript
throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
```

### Rate Limiting

`protectedProcedure` runs `withRateLimit` before the resolver (override with `.meta({ rateLimit })`). Public procedures call `rateLimit` in the resolver so cache hits and cheap bail-outs do not consume the budget.

```typescript
import { rateLimit, publicProcedure } from "@domainstack/api";

expensiveOperation: publicProcedure.mutation(async ({ ctx, input, path }) => {
  await rateLimit({ ctx, path, config: { requests: 10, window: "1 m" } });
  return doWork(input);
}),

getThing: publicProcedure.query(async ({ ctx, input, path }) => {
  const cached = await getCachedThing(input.id);
  if (cached.data && !cached.stale) {
    return { success: true, cached: true, data: cached.data };
  }
  await rateLimit({ ctx, path, config: { requests: 30, window: "1 m" } });
  return fetchThing(input.id);
}),
```

- Override the default 60/min on protected procedures with `.meta({ rateLimit })`, or skip with `.meta({ rateLimit: false })`
- Identifier is user ID when authenticated, otherwise IP
- Each procedure gets its own bucket (keyed by procedure path)
- On limit exceeded: throws `TOO_MANY_REQUESTS` with retry timing
- Client-side: `rateLimitLink` in tRPC client shows toasts automatically
- For API routes, use `checkRateLimit()` from `@/lib/ratelimit/api`

## Logging

Server-side only using Pino (object-first API):

```typescript
import { createLogger } from "@domainstack/logger";
const logger = createLogger({ source: "dns" });

logger.info({ domain: "example.com", count: 5 }, "resolution complete");
logger.error({ err: error, domain: "example.com" }, "failed to resolve");
```

Client-side: Use `analytics.trackException(error, context)` for errors.

## Testing Patterns

### File Organization

- Node tests: `**/*.test.ts` (run in Node environment)
- Browser tests: `**/*.test.tsx` (run in Playwright browser)
- Tests live next to the code they test

### Mocking

- Analytics and logger are globally mocked in `vitest.setup.node.ts`
- Use `vi.hoisted` for ESM module mocks
- Use PGlite for isolated database testing: `makePGliteDb` / `closePGliteDb`
  from `@domainstack/db/testing`. Initialize the DB *before* importing any
  module that uses it — see `packages/polar/src/user-subscription.test.ts`
  for the required dynamic-import ordering.
- Mock `@vercel/blob` for storage tests

### Example Test

```typescript
import { describe, expect, it, vi } from "vitest";

describe("myFunction", () => {
  it("should do something", async () => {
    const result = await myFunction("input");
    expect(result).toBe("expected");
  });
});
```

Browser tests (`*.test.tsx`) use `vitest-browser-react` and locators from `vitest/browser`. Render through `@/mocks/react`, query with `page.getBy*`, interact with locator actions (`click()`, `fill()`, `hover()`), and assert with `await expect.element(...)`. Do not use Testing Library.

## Project Structure

This is a **Turborepo monorepo** with the following structure:

```
domainstack.io/
├── apps/
│   └── web/                    # Next.js application (@domainstack/web)
│       ├── app/                # Next.js App Router
│       ├── components/         # App-specific components
│       │   └── ui/             # App-specific UI wrappers (Next.js-aware)
│       ├── hooks/              # App-specific React hooks
│       ├── lib/                # App-local utilities (atoms, stores, chat, ratelimit)
│       ├── emails/             # React Email templates
│       └── trpc/               # tRPC client setup + the RSC headers() context wrapper
├── packages/
│   ├── api/                    # tRPC init, procedures, middleware, routers, appRouter (@domainstack/api)
│   ├── auth/                   # Better Auth server/client config
│   ├── blob/                   # Vercel Blob storage wrapper
│   ├── constants/               # Shared constants; primitives/ holds enum arrays
│   ├── core/                    # Domain data services (@domainstack/core), one folder per data source
│   │   └── src/                 #   one folder per data source; `index.ts` is its persisting service
│   │                            #   (dns/ headers/ tls/ seo/ whois/ also keep low-level fetch/parse files beside it)
│   │                            #   hosting/ favicon/ provider-logo/ pricing/ verification/
│   │                            #   lookup/ (cache → rate limit → fetch orchestrator), lib/ (ttl, cloudflare, in-flight, fetch-errors)
│   ├── db/                     # Drizzle schema, client, and query layer
│   ├── edge-config/             # Vercel Edge Config reader
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
│   │       └── lib/            # Utilities (cn, etc.)
│   ├── utils/                   # Pure helpers shared by 2+ packages: dates, domains, DNS records, providers
│   └── workflows/               # Every "use workflow"/"use step" but chat (@domainstack/workflows)
│       └── src/
│           ├── steps/          # Shared step wrappers (dns, headers, certificates, hosting, registration, …)
│           └── lib/            # Non-step code shared by 2+ workflows: change-detection.ts, errors.ts (classifyDatabaseError), monitor-lock.ts, settled.ts
├── turbo.json                  # Turborepo task configuration
├── pnpm-workspace.yaml         # pnpm workspace definition
└── package.json                # Root workspace config
```

All commands run from the **monorepo root** via Turborepo.

### Package boundaries

The backend is layered strictly one-way: `apps/web` → `@domainstack/api` →
`@domainstack/workflows` → `@domainstack/core` → `db`, `redis`, `safe-fetch`,
`edge-config`, `image`, `utils`, etc. (`api` may also call `core` directly, and
`apps/web`'s cron/screenshot routes call `start()` on workflows directly.)

1. **`@domainstack/core`**: plain async domain services (fetch, normalize,
   persist). Never imports `workflow`, `@trpc/*`, or `next/*`.
2. **`@domainstack/workflows`**: every `"use workflow"`/`"use step"` function
   except chat, plus the step wrappers and workflow infrastructure. Never
   imports `@trpc/*`, `next/*`, or `@domainstack/api`.
3. **`@domainstack/api`**: tRPC init, middleware, all routers, `appRouter`,
   `AppRouter`, `RouterInputs`/`RouterOutputs`, `createCaller`. May `start()`
   workflows directly, no dependency injection. No `next/*` imports.
4. **`apps/web`**: route handlers, the RSC context wrapper (`trpc/init.ts`),
   UI, and the chat workflow (the one exception that stays in the Next app).
5. No package cycles, and no one-line `index.ts` barrels — `package.json`
   `exports` point straight at the implementation files.
6. Code lives with its only consumer. `@domainstack/utils` holds pure helpers
   (no network I/O) used by two or more packages. Within `@domainstack/workflows`,
   code used by one workflow sits in that workflow's folder; code shared by two or
   more workflows goes in `lib/` (or `steps/` when it is a step). Exception: tested
   helpers stay out of `@domainstack/db`, which has no test runner.

### Package Imports

**Constants** (`@domainstack/constants`):

```typescript
// Pure constants - no runtime dependencies
import { DNS_RECORD_TYPES, PLANS, REPOSITORY_SLUG } from "@domainstack/constants";
```

**Types** (`@domainstack/types`):

```typescript
import type { DnsRecord, RegistrationResponse, Certificate } from "@domainstack/types";
```

**Database** (`@domainstack/db`):

```typescript
import { db } from "@domainstack/db/client";
import { domains, userTrackedDomains } from "@domainstack/db/schema";
import { getCachedRegistration } from "@domainstack/db/queries/registrations";
```

All database access goes through `packages/db/src/queries/*` — do not write
Drizzle queries directly in `apps/web`. Cached read functions are named
`getCached*` and return `CacheResult<T>` with staleness metadata.

**Domain services** (`@domainstack/core`):

```typescript
import { fetchDns } from "@domainstack/core/dns";
import { lookupWhois } from "@domainstack/core/whois";
```

Outbound domain lookups (DNS, TLS, WHOIS/RDAP, SEO, headers) live here, not in
`apps/web`. They already handle caching, retries, and SSRF-safe fetching.

**UI Components** (`@domainstack/ui`):

```typescript
import { Button } from "@domainstack/ui/button";
import { Card, CardHeader, CardContent } from "@domainstack/ui/card";
import { cn } from "@domainstack/ui/utils";
import { useMediaQuery } from "@domainstack/ui/hooks";
```

**App-specific wrappers** (in `apps/web/components/ui/`):

- `sonner.tsx` — Configures toast notifications with theme support and custom icons

## Key Patterns

### SWR Caching

Repository functions return `CacheResult<T>` with staleness metadata:

```typescript
const { data, stale } = await getCachedRegistration("example.com");
if (stale) {
  // Trigger background revalidation
}
```

### Report Scopes: Hostname vs Registrable Domain

A report describes the exact hostname requested (`/api.example.com` and
`/www.example.com` are their own reports). Registration and tracking belong to
its registrable domain (eTLD+1); every other section describes the hostname.

| Scope | Sections / features |
| --- | --- |
| Registrable domain (`example.com`) | registration (RDAP/WHOIS), tracking, verification, registrar pricing |
| Exact hostname (`api.example.com`) | DNS, hosting, certificates, headers, SEO, favicon, screenshot |

- Parse a report target with `parseDomainTarget(input)` from
  `@domainstack/utils/domain` → `{ hostname, registrableDomain, isSubdomain }`.
  `toRegistrableDomain` still collapses to eTLD+1.
- Normalize user input with `normalizeHostnameInput` (keeps `www`) for reports
  and navigation. `normalizeDomainInput` strips `www.` and is only for
  registrable-domain callers such as domain verification.
- tRPC inputs: `HostnameInputSchema` or `RegistrableDomainInputSchema` from
  `packages/api/src/domain-input.ts`, matching the section's scope.
- `lookupSection`/`fetchSection` throw if registration is requested for a
  subdomain, so registration is never stored under a hostname row.
- The `domains` table holds both registrable domains and hostname observations.
  A row does not imply registration or tracking; only `userTrackedDomains`
  rows are tracked. The warm-domains workflow refreshes registration only for
  registrable-domain rows, and only refreshes sections that already have cached
  data (a parent touched only by its subdomains' registration lookups isn't
  fully scanned).
- The report page resolves the hostname's own row id once
  (`getOrCreateDomainId(hostname)`) and passes it down; hostname-scoped features
  such as screenshots are keyed by it, never by the registrable domain's id.
- Lookups keyed by registrable domain that must also cover subdomains (e.g. the
  blocklist) check `hostnameWithParents(hostname)`.
- Chat and MCP tools still look everything up by registrable domain.

### Workflow Concurrency

The hourly `monitor-domains` cron must not start a second `detectChangesWorkflow`
for a domain whose previous run is still in flight. Use the per-domain Redis lock
in `@domainstack/workflows/monitor-lock`:

```typescript
import { acquireMonitorLock, releaseMonitorLock } from "@domainstack/workflows/monitor-lock";

const ownerToken = await acquireMonitorLock(trackedDomainId);
if (!ownerToken) {
  // Another run holds the lock — skip this domain this tick.
  return;
}
// ...start the workflow, passing ownerToken so the workflow can release it...
await releaseMonitorLock(trackedDomainId, ownerToken);
```

The lock is acquired by the cron and released by the workflow on successful
completion. It fails open: if Redis is unconfigured or unreachable, work proceeds
without dedup rather than halting monitoring. Release is an owner-token
compare-and-delete, so a run can never release a lock it does not hold.

### Protected tRPC Procedures

```typescript
import { protectedProcedure } from "@domainstack/api";

export const myRouter = createTRPCRouter({
  myProcedure: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id; // Guaranteed to exist
  }),
});
```

### Optimistic Updates (TanStack Query)

```typescript
const mutation = useMutation({
  ...trpc.tracking.removeDomain.mutationOptions(),
  onMutate: async (variables) => {
    await queryClient.cancelQueries({ queryKey });
    const previous = queryClient.getQueryData(queryKey);
    queryClient.setQueryData(queryKey, (old) => /* optimistic update */);
    return { previous };
  },
  onError: (err, _vars, context) => {
    if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
  },
  onSettled: () => void queryClient.invalidateQueries({ queryKey }),
});
```

### Suspense with TanStack Query

Use `useSuspenseQuery` for declarative data fetching with React Suspense boundaries.
Exemplar: `components/domain/report-client.tsx`

**When to use Suspense:**

- Simple read-only queries without `enabled` flag
- Components that render data immediately (no conditional logic)
- Parallel independent data sections that can load separately

**When NOT to use Suspense:**

- Queries with `enabled` option (conditional fetching)
- Hooks with mutations and optimistic updates (e.g., `useTrackedDomains`)
- Lazy-loaded data (hover triggers, infinite scroll)
- Polling-based queries

**Pattern:**

```tsx
// Parent wraps with boundaries
<ErrorBoundary fallback={<ErrorFallback />}>
  <Suspense fallback={<MySkeleton />}>
    <MyComponent />
  </Suspense>
</ErrorBoundary>;

// Component uses useSuspenseQuery - data is guaranteed non-null
function MyComponent() {
  const { data } = useSuspenseQuery(trpc.myRouter.myQuery.queryOptions());
  return <div>{data.value}</div>;
}
```

**Parallel queries:**

```tsx
function MyComponent() {
  const [query1, query2] = useSuspenseQueries({
    queries: [trpc.router1.query1.queryOptions(), trpc.router2.query2.queryOptions()],
  });
  // Both are guaranteed to have data
}
```

**Error boundaries:**

- Use `SectionErrorBoundary` for domain report sections
- Use `SettingsErrorBoundary` for settings panels
- Create context-specific boundaries with `CreateIssueButton` for error reporting

**Skeleton requirements:**

- MUST mirror final content layout to prevent CLS
- Export skeleton components for reuse (e.g., `CalendarInstructionsSkeleton`)

## AI Chat

The AI chat assistant (`components/chat/`) provides natural language domain lookups using Vercel's Workflow SDK.

### Architecture

- **Client**: `useChat` + `WorkflowChatTransport` (`@ai-sdk/workflow`) with Zustand session persistence
- **API**: `POST /api/chat` starts workflow, returns streaming response; `GET /api/chat/:runId/stream` reconnects
- **Workflow**: `apps/web/lib/chat/workflow.ts` uses `WorkflowAgent` from `@ai-sdk/workflow` for durable tool execution
- **Tools**: `apps/web/lib/chat/tools.ts` defines domain lookup tools (WHOIS, DNS, SSL, etc.)

### Constants (`packages/constants/src/ai.ts`)

All chat limits are centralized for client/server consistency.

### Rate Limits

Differentiated by auth status and endpoint.

### Security Layers

1. **Rate limiting**: Per-user/IP via Upstash Redis
2. **Input validation**: Zod schema validates message structure and length
3. **Conversation truncation**: Only last N messages sent to model
4. **System prompt defense**: Refuses off-topic questions, ignores override attempts

### Adding New Tools

1. Add the tool's `name`, `section`, `status` label, and `description` to `DOMAIN_TOOL_DEFS` in `apps/web/lib/chat/domain-tools.ts`; `createDomainToolset()` (`tools.ts`) and the browser client tools build from it
2. Mention the tool in the system prompt (`apps/web/lib/chat/system-prompt.ts`) if the model needs guidance on when to call it
3. Tools call `lookupSection` from `@domainstack/core/lookup`, which applies the same per-section cache and rate limits as the tRPC domain procedures
