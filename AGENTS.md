# Repository Guidelines

## Pre-Commit Checklist

**CRITICAL:** Before declaring victory on any task and before committing to git, the following three commands must pass with NO WARNINGS:

1. `pnpm lint` — Must pass with zero warnings
2. `pnpm check-types` — Must pass with zero warnings
3. `pnpm test` — Must pass with zero warnings

Do not proceed with commits until all three checks are clean.

## Commands

### Development
- `pnpm dev` — Start Next.js dev server at http://localhost:3000
- `pnpm build` — Compile production bundle
- `pnpm check-types` — Run `tsc --noEmit` for type diagnostics

### Linting & Formatting
- `pnpm lint` — Run Biome lint (add `--write` to auto-fix, `--write --unsafe` to sort Tailwind classes, etc)
- `pnpm format` — Apply Biome formatting

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
- 2-space indentation (Biome enforces)
- Prefer small, pure modules
- Node.js >= 24 required

### Naming Conventions
- **Files/folders:** kebab-case (`user-settings.ts`)
- **React components:** PascalCase exports (`UserSettings`)
- **Helpers/hooks:** camelCase named exports (`useUserSettings`)

### Imports
- Use `@/...` path aliases for app-specific imports
- Import shared UI components from `@domainstack/ui/*` (e.g., `@domainstack/ui/button`)
- Biome auto-organizes imports on save
- Client components must start with `"use client"`

### Types
- Shared domain types in `@domainstack/types` package
- Enum const arrays (primitives) in `@domainstack/constants` (Drizzle pgEnums derive from these)
- Do NOT use Zod for simple enums or internal database types
- Import types from `@domainstack/types`

### Tailwind Classes
- Biome enforces sorted Tailwind classes via `useSortedClasses` rule
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
Use `lib/workflow/errors.ts` utilities for proper error classification:
```typescript
import { classifyFetchError, withFetchErrorHandling } from "@/lib/workflow";

async function fetchDataStep(domain: string): Promise<Data> {
  "use step";
  return await withFetchErrorHandling(
    () => fetchData(domain),
    { context: `fetching ${domain}` }
  );
}
```

Error classification:
- **FatalError** (don't retry): DNS errors, TLS errors, invalid URLs, blocked hosts
- **RetryableError** (retry with backoff): Timeouts, network errors, server errors

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
Use Upstash Redis for rate limiting via the `withRateLimit` middleware:
```typescript
import { publicProcedure, withRateLimit } from "@/trpc/init";

export const myRouter = createTRPCRouter({
  expensiveOperation: publicProcedure
    .use(withRateLimit)
    .meta({ rateLimit: { requests: 10, window: "1 m" } })
    .mutation(async ({ input }) => {
      // Rate limited to 10 requests per minute per user/IP
    }),
});
```

- Middleware uses user ID for authenticated requests, IP for anonymous
- Each procedure gets its own bucket (keyed by procedure path)
- On limit exceeded: throws `TOO_MANY_REQUESTS` with retry timing
- Client-side: `rateLimitLink` in tRPC client shows toasts automatically
- For API routes, use `checkRateLimit()` from `@/lib/ratelimit/api`

## Logging

Server-side only using Pino (object-first API):
```typescript
import { createLogger } from "@/lib/logger/server";
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
- Use PGlite (`@/lib/db/pglite`) for isolated database testing
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
│       ├── lib/                # Domain utilities and shared modules
│       │   ├── db/             # Drizzle schema and repository layer
│       │   └── workflow/       # Workflow utilities (deduplication, SWR, errors)
│       ├── server/routers/     # tRPC router definitions
│       ├── workflows/          # Vercel Workflow definitions
│       ├── emails/             # React Email templates
│       └── trpc/               # tRPC client setup
├── packages/
│   ├── constants/              # Shared constants (@domainstack/constants)
│   │   └── src/
│   │       ├── primitives/     # Enum arrays (DNS types, plans, providers, etc.)
│   │       ├── cache/          # TTL constants
│   │       └── validation/     # Domain validation constants
│   ├── types/                  # Shared TypeScript types (@domainstack/types)
│   │   └── src/
│   │       └── domain/         # Domain-related types (DNS, certs, headers, etc.)
│   ├── ui/                     # Shared UI component library (@domainstack/ui)
│   │   └── src/
│   │       ├── components/     # Framework-agnostic UI primitives
│   │       ├── hooks/          # Shared React hooks
│   │       └── lib/            # Utilities (cn, etc.)
│   └── typescript-config/      # Shared TypeScript configs (@domainstack/typescript-config)
├── turbo.json                  # Turborepo task configuration
├── pnpm-workspace.yaml         # pnpm workspace definition
├── package.json                # Root workspace config
├── tsconfig.json               # Base TypeScript config
└── biome.json                  # Linting/formatting config
```

All commands run from the **monorepo root** via Turborepo.

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

**UI Components** (`@domainstack/ui`):
```typescript
import { Button } from "@domainstack/ui/button";
import { Card, CardHeader, CardContent } from "@domainstack/ui/card";
import { cn } from "@domainstack/ui/utils";
import { useMediaQuery } from "@domainstack/ui/hooks";
```

**App-specific wrappers** (in `apps/web/components/ui/`):
- `sonner.tsx` — Configures toast notifications with theme support

## Key Patterns

### SWR Caching
Repository functions return `CacheResult<T>` with staleness metadata:
```typescript
const { data, stale } = await getRegistration("example.com");
if (stale) {
  // Trigger background revalidation
}
```

### Workflow Concurrency
Use deduplication for concurrent requests:
```typescript
import { startWithDeduplication, getDeduplicationKey } from "@/lib/workflow";
import { start } from "workflow/api";

const key = getDeduplicationKey("registration", domain);
const { result, deduplicated, source } = await startWithDeduplication(
  key,
  () => start(registrationWorkflow, [{ domain }]),
);
// result: T - the workflow return value
// deduplicated: boolean - true if attached to existing run
// source: "memory" | "redis" | "new" - where deduplication occurred
```

### Protected tRPC Procedures
```typescript
import { protectedProcedure } from "@/trpc/init";

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
</ErrorBoundary>

// Component uses useSuspenseQuery - data is guaranteed non-null
function MyComponent() {
  const { data } = useSuspenseQuery(
    trpc.myRouter.myQuery.queryOptions()
  );
  return <div>{data.value}</div>;
}
```

**Parallel queries:**
```tsx
function MyComponent() {
  const [query1, query2] = useSuspenseQueries({
    queries: [
      trpc.router1.query1.queryOptions(),
      trpc.router2.query2.queryOptions(),
    ],
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
- **Client**: `useDomainChat` hook with session persistence via localStorage
- **API**: `POST /api/chat` starts workflow, returns streaming response
- **Workflow**: `workflows/chat/workflow.ts` uses `DurableAgent` for durable tool execution
- **Tools**: `workflows/chat/tools.ts` defines domain lookup tools (WHOIS, DNS, SSL, etc.)

### Constants (`lib/constants/ai.ts`)
All chat limits are centralized for client/server consistency.

### Rate Limits
Differentiated by auth status and endpoint.

### Security Layers
1. **Rate limiting**: Per-user/IP via Upstash Redis
2. **Input validation**: Zod schema validates message structure and length
3. **Conversation truncation**: Only last N messages sent to model
4. **System prompt defense**: Refuses off-topic questions, ignores override attempts

### Adding New Tools
1. Define tool in `workflows/chat/tools.ts` using `createDomainToolset()`
2. Add human-readable title in `components/chat/utils.ts` (`TOOL_TITLES`)
3. Tools call tRPC procedures which have their own rate limits

<!-- NEXT-AGENTS-MD-START -->[Next.js Docs Index]|root: ./.next-docs|STOP. What you remember about Next.js is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: npx @next/codemod agents-md --output AGENTS.md|01-app:{04-glossary.mdx}|01-app/01-getting-started:{01-installation.mdx,02-project-structure.mdx,03-layouts-and-pages.mdx,04-linking-and-navigating.mdx,05-server-and-client-components.mdx,06-cache-components.mdx,07-fetching-data.mdx,08-updating-data.mdx,09-caching-and-revalidating.mdx,10-error-handling.mdx,11-css.mdx,12-images.mdx,13-fonts.mdx,14-metadata-and-og-images.mdx,15-route-handlers.mdx,16-proxy.mdx,17-deploying.mdx,18-upgrading.mdx}|01-app/02-guides:{analytics.mdx,authentication.mdx,backend-for-frontend.mdx,caching.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,data-security.mdx,debugging.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,incremental-static-regeneration.mdx,instrumentation.mdx,internationalization.mdx,json-ld.mdx,lazy-loading.mdx,local-development.mdx,mcp.mdx,mdx.mdx,memory-usage.mdx,multi-tenant.mdx,multi-zones.mdx,open-telemetry.mdx,package-bundling.mdx,prefetching.mdx,production-checklist.mdx,progressive-web-apps.mdx,public-static-pages.mdx,redirecting.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,single-page-applications.mdx,static-exports.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx,videos.mdx}|01-app/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|01-app/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|01-app/02-guides/upgrading:{codemods.mdx,version-14.mdx,version-15.mdx,version-16.mdx}|01-app/03-api-reference:{07-edge.mdx,08-turbopack.mdx}|01-app/03-api-reference/01-directives:{use-cache-private.mdx,use-cache-remote.mdx,use-cache.mdx,use-client.mdx,use-server.mdx}|01-app/03-api-reference/02-components:{font.mdx,form.mdx,image.mdx,link.mdx,script.mdx}|01-app/03-api-reference/03-file-conventions/01-metadata:{app-icons.mdx,manifest.mdx,opengraph-image.mdx,robots.mdx,sitemap.mdx}|01-app/03-api-reference/03-file-conventions:{default.mdx,dynamic-routes.mdx,error.mdx,forbidden.mdx,instrumentation-client.mdx,instrumentation.mdx,intercepting-routes.mdx,layout.mdx,loading.mdx,mdx-components.mdx,not-found.mdx,page.mdx,parallel-routes.mdx,proxy.mdx,public-folder.mdx,route-groups.mdx,route-segment-config.mdx,route.mdx,src-folder.mdx,template.mdx,unauthorized.mdx}|01-app/03-api-reference/04-functions:{after.mdx,cacheLife.mdx,cacheTag.mdx,connection.mdx,cookies.mdx,draft-mode.mdx,fetch.mdx,forbidden.mdx,generate-image-metadata.mdx,generate-metadata.mdx,generate-sitemaps.mdx,generate-static-params.mdx,generate-viewport.mdx,headers.mdx,image-response.mdx,next-request.mdx,next-response.mdx,not-found.mdx,permanentRedirect.mdx,redirect.mdx,refresh.mdx,revalidatePath.mdx,revalidateTag.mdx,unauthorized.mdx,unstable_cache.mdx,unstable_noStore.mdx,unstable_rethrow.mdx,updateTag.mdx,use-link-status.mdx,use-params.mdx,use-pathname.mdx,use-report-web-vitals.mdx,use-router.mdx,use-search-params.mdx,use-selected-layout-segment.mdx,use-selected-layout-segments.mdx,userAgent.mdx}|01-app/03-api-reference/05-config/01-next-config-js:{adapterPath.mdx,allowedDevOrigins.mdx,appDir.mdx,assetPrefix.mdx,authInterrupts.mdx,basePath.mdx,browserDebugInfoInTerminal.mdx,cacheComponents.mdx,cacheHandlers.mdx,cacheLife.mdx,compress.mdx,crossOrigin.mdx,cssChunking.mdx,devIndicators.mdx,distDir.mdx,env.mdx,expireTime.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,htmlLimitedBots.mdx,httpAgentOptions.mdx,images.mdx,incrementalCacheHandlerPath.mdx,inlineCss.mdx,isolatedDevBuild.mdx,logging.mdx,mdxRs.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,pageExtensions.mdx,poweredByHeader.mdx,productionBrowserSourceMaps.mdx,proxyClientMaxBodySize.mdx,reactCompiler.mdx,reactMaxHeadersLength.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,sassOptions.mdx,serverActions.mdx,serverComponentsHmrCache.mdx,serverExternalPackages.mdx,staleTimes.mdx,staticGeneration.mdx,taint.mdx,trailingSlash.mdx,transpilePackages.mdx,turbopack.mdx,turbopackFileSystemCache.mdx,typedRoutes.mdx,typescript.mdx,urlImports.mdx,useLightningcss.mdx,viewTransition.mdx,webVitalsAttribution.mdx,webpack.mdx}|01-app/03-api-reference/05-config:{02-typescript.mdx,03-eslint.mdx}|01-app/03-api-reference/06-cli:{create-next-app.mdx,next.mdx}|02-pages/01-getting-started:{01-installation.mdx,02-project-structure.mdx,04-images.mdx,05-fonts.mdx,06-css.mdx,11-deploying.mdx}|02-pages/02-guides:{analytics.mdx,authentication.mdx,babel.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,debugging.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,incremental-static-regeneration.mdx,instrumentation.mdx,internationalization.mdx,lazy-loading.mdx,mdx.mdx,multi-zones.mdx,open-telemetry.mdx,package-bundling.mdx,post-css.mdx,preview-mode.mdx,production-checklist.mdx,redirecting.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,static-exports.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx}|02-pages/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|02-pages/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|02-pages/02-guides/upgrading:{codemods.mdx,version-10.mdx,version-11.mdx,version-12.mdx,version-13.mdx,version-14.mdx,version-9.mdx}|02-pages/03-building-your-application/01-routing:{01-pages-and-layouts.mdx,02-dynamic-routes.mdx,03-linking-and-navigating.mdx,05-custom-app.mdx,06-custom-document.mdx,07-api-routes.mdx,08-custom-error.mdx}|02-pages/03-building-your-application/02-rendering:{01-server-side-rendering.mdx,02-static-site-generation.mdx,04-automatic-static-optimization.mdx,05-client-side-rendering.mdx}|02-pages/03-building-your-application/03-data-fetching:{01-get-static-props.mdx,02-get-static-paths.mdx,03-forms-and-mutations.mdx,03-get-server-side-props.mdx,05-client-side.mdx}|02-pages/03-building-your-application/06-configuring:{12-error-handling.mdx}|02-pages/04-api-reference:{06-edge.mdx,08-turbopack.mdx}|02-pages/04-api-reference/01-components:{font.mdx,form.mdx,head.mdx,image-legacy.mdx,image.mdx,link.mdx,script.mdx}|02-pages/04-api-reference/02-file-conventions:{instrumentation.mdx,proxy.mdx,public-folder.mdx,src-folder.mdx}|02-pages/04-api-reference/03-functions:{get-initial-props.mdx,get-server-side-props.mdx,get-static-paths.mdx,get-static-props.mdx,next-request.mdx,next-response.mdx,use-params.mdx,use-report-web-vitals.mdx,use-router.mdx,use-search-params.mdx,userAgent.mdx}|02-pages/04-api-reference/04-config/01-next-config-js:{adapterPath.mdx,allowedDevOrigins.mdx,assetPrefix.mdx,basePath.mdx,bundlePagesRouterDependencies.mdx,compress.mdx,crossOrigin.mdx,devIndicators.mdx,distDir.mdx,env.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,httpAgentOptions.mdx,images.mdx,isolatedDevBuild.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,pageExtensions.mdx,poweredByHeader.mdx,productionBrowserSourceMaps.mdx,proxyClientMaxBodySize.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,serverExternalPackages.mdx,trailingSlash.mdx,transpilePackages.mdx,turbopack.mdx,typescript.mdx,urlImports.mdx,useLightningcss.mdx,webVitalsAttribution.mdx,webpack.mdx}|02-pages/04-api-reference/04-config:{01-typescript.mdx,02-eslint.mdx}|02-pages/04-api-reference/05-cli:{create-next-app.mdx,next.mdx}|03-architecture:{accessibility.mdx,fast-refresh.mdx,nextjs-compiler.mdx,supported-browsers.mdx}|04-community:{01-contribution-guide.mdx,02-rspack.mdx}<!-- NEXT-AGENTS-MD-END -->
