import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";

import { apiBaseUrl } from "./env";

WebBrowser.maybeCompleteAuthSession();

export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
  plugins: [
    expoClient({
      scheme: "domainstack",
      storagePrefix: "domainstack",
      storage: SecureStore,
    }),
  ],
});

export type AuthProvider = "apple" | "github" | "google";

export async function signInWithProvider(provider: AuthProvider) {
  return authClient.signIn.social({
    provider,
    callbackURL: Linking.createURL("/"),
  });
}

export async function signOut() {
  return authClient.signOut();
}

export function getAuthCookieHeader(): string | null {
  return authClient.getCookie() || null;
}
