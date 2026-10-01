import { createPolarCore } from "@polar-sh/sdk/2026-10";

/**
 * Shared singleton Polar SDK client for server-side use.
 *
 * Returns `null` when `POLAR_ACCESS_TOKEN` is unset — consumers must handle
 * the disabled state. Uses VERCEL_ENV (not NODE_ENV) so preview deployments
 * don't accidentally hit production Polar.
 *
 * This is a core client pinned to API version 2026-10 (the better-auth plugin
 * requires one): it has no service properties, so import operations from
 * `@polar-sh/sdk/2026-10/services/*` and pass this client to them.
 */
export const polarClient = process.env.POLAR_ACCESS_TOKEN
  ? createPolarCore({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      environment: process.env.VERCEL_ENV === "production" ? "production" : "sandbox",
    })
  : null;
