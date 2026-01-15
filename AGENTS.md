# Repository Guidelines

## Issue Tracking

This project uses **bd (beads)** for issue tracking.
Run `bd prime` for workflow context, or install hooks (`bd hooks install`) for auto-injection.

**Quick reference:**
- `bd ready` - Find unblocked work
- `bd create "Title" --type task --priority 2` - Create issue
- `bd close <id>` - Complete work

For full workflow details: `bd prime`

## Pre-Commit Checklist

**CRITICAL:** Before declaring victory on any task and before committing to git, the following three commands must pass with NO WARNINGS:

1. `pnpm lint` — Must pass with zero warnings
2. `pnpm typecheck` — Must pass with zero warnings
3. `pnpm test:run` — Must pass with zero warnings

Do not proceed with commits until all three checks are clean.

## Commands

### Development
- `pnpm dev` — Start Next.js dev server at http://localhost:3000
- `pnpm build` — Compile production bundle
- `pnpm typecheck` — Run `tsc --noEmit` for type diagnostics

### Linting & Formatting
- `pnpm lint` — Run Biome lint (`--write` to auto-fix; add `--unsafe` to sort Tailwind classes, etc)
- `pnpm format` — Apply Biome formatting

### Testing
- `pnpm test` — Run Vitest in watch mode
- `pnpm test:run` — Run all tests once
- `pnpm test:run path/to/file.test.ts` — Run a single test file
- `pnpm test:run -t "test name"` — Run tests matching a pattern
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
- **Constants:** Organize in `lib/constants/` submodules

### Imports
- Use `@/...` path aliases for all imports
- Biome auto-organizes imports on save
- Client components must start with `"use client"`

### Types
- Plain TypeScript in `lib/types/` for internal data structures
- Enum const arrays in `lib/types/primitives.ts` (Drizzle pgEnums derive from these)
- Do NOT use Zod for simple enums or internal database types
- Import types from `@/lib/types`

### Tailwind Classes
- Biome enforces sorted Tailwind classes via `useSortedClasses` rule
- Use `cn()`, `clsx()`, or `cva()` for conditional classes

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
- Analytics, logger, and Inngest are globally mocked in `vitest.setup.node.ts`
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

- `app/` — Next.js App Router (default to server components)
- `components/` — Reusable UI primitives
- `hooks/` — Shared React hooks
- `lib/` — Domain utilities and shared modules
- `lib/db/` — Drizzle schema and repository layer
- `lib/domain/` — Core domain lookup implementations
- `lib/inngest/` — Background job functions
- `lib/workflow/` — Workflow utilities (deduplication, SWR, errors)
- `server/routers/` — tRPC router definitions
- `workflows/` — Vercel Workflow definitions
- `emails/` — React Email templates
- `trpc/` — tRPC client setup

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

const key = getDeduplicationKey("registration", domain);
const result = await startWithDeduplication(key, async () => {
  const run = await start(registrationWorkflow, [{ domain }]);
  return run.returnValue;
});
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
