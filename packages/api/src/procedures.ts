import { withAuth } from "./middleware/auth";
import { withLogging } from "./middleware/logging";
import { withRateLimit } from "./middleware/rate-limit";
import { t } from "./trpc";

/**
 * Public procedure with logging and no automatic rate limit.
 * Call `rateLimit` in the resolver (after a cache hit / cheap bail-out).
 */
export const publicProcedure = t.procedure.use(withLogging);

/**
 * Protected procedure requiring authentication.
 * Rate-limited by default (60 req/min); override with `.meta({ rateLimit })`
 * or skip with `.meta({ rateLimit: false })`.
 */
export const protectedProcedure = publicProcedure.use(withAuth).use(withRateLimit);
