import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";

import {
  createNativeAuthClient,
  getNativeAuthCookieHeader,
  signInWithAppleIdentityToken,
  signInWithNativeProvider,
  type NativeAuthProvider,
} from "@domainstack/auth/native";

import { apiBaseUrl } from "./env";

WebBrowser.maybeCompleteAuthSession();

export const authClient = createNativeAuthClient({
  baseURL: apiBaseUrl,
  storage: SecureStore,
});

export type AuthProvider = NativeAuthProvider;

export async function signInWithProvider(provider: AuthProvider) {
  return signInWithNativeProvider(authClient, provider, Linking.createURL("/"));
}

export async function signInWithAppleToken(token: string, nonce?: string) {
  return signInWithAppleIdentityToken(authClient, token, Linking.createURL("/"), nonce);
}

export async function signOut() {
  return authClient.signOut();
}

export function getAuthCookieHeader(): string | null {
  return getNativeAuthCookieHeader(authClient);
}
