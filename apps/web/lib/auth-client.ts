import { polarClient } from "@polar-sh/better-auth/client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  plugins: [polarClient()],
});

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
