import { polarClient } from "@domainstack/polar/better-auth/client";
import { createAuthClient } from "better-auth/react";

/**
 * Configured Better Auth client instance with Polar integration.
 * Reads NEXT_PUBLIC_BASE_URL from environment (inlined at build time by Next.js).
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  plugins: [polarClient()],
});

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
  customer,
  checkoutEmbed,
} = authClient;
