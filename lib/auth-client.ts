import { polarClient } from "@polar-sh/better-auth";
import { createAuthClient } from "better-auth/react";
import { BASE_URL } from "@/lib/constants";

export const authClient = createAuthClient({
  baseURL: BASE_URL,
  plugins: [polarClient()],
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  getSession,
  checkout,
  deleteUser,
} = authClient;

/**
 * Open the Polar customer portal.
 * Uses authClient.customer.portal() under the hood.
 */
export async function customerPortal() {
  return authClient.customer.portal();
}
