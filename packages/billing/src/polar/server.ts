import { Polar } from "@polar-sh/sdk";

/**
 * Shared singleton Polar SDK client for server-side use.
 *
 * Returns `null` when `POLAR_ACCESS_TOKEN` is unset — consumers must handle
 * the disabled state. Uses VERCEL_ENV (not NODE_ENV) so preview deployments
 * don't accidentally hit production Polar.
 */
export const polarClient = process.env.POLAR_ACCESS_TOKEN
  ? new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      server: process.env.VERCEL_ENV === "production" ? "production" : "sandbox",
    })
  : null;
