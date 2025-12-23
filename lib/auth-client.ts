import { polarClient } from "@polar-sh/better-auth/client";
import { createAuthClient } from "better-auth/react";
import { BASE_URL } from "@/lib/constants";

export const authClient = createAuthClient({
  baseURL: BASE_URL,
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
  checkout,
  checkoutEmbed,
} = authClient;
