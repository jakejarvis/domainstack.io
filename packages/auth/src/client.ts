import { createAuthClient } from "better-auth/react";

import { polarClient } from "@domainstack/polar/better-auth/client";

/**
 * Configured Better Auth client instance with Polar integration.
 * Reads NEXT_PUBLIC_BASE_URL from environment (inlined at build time by Next.js).
 */
const client = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  plugins: [polarClient()],
});

export const authClient: ReturnType<typeof createAuthClient> = client;

// Re-export individual methods for convenience
export const {
  useSession,
  getSession,
  signIn,
  signUp,
  signOut,
  linkSocial,
  unlinkAccount,
  deleteUser,
  // Provided by Polar client adapter:
  checkoutEmbed,
} = client;

// The full `customer` API returns @polar-sh/sdk models that live in unexported,
// hashed chunks and can't be named in declarations; expose only what the app uses.
export const customer: Pick<typeof client.customer, "portal"> = client.customer;
