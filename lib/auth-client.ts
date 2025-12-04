import { createAuthClient } from "better-auth/react";
import { BASE_URL } from "@/lib/constants";

export const authClient = createAuthClient({
  baseURL: BASE_URL,
});

export const { signIn, signOut, signUp, useSession, getSession } = authClient;
