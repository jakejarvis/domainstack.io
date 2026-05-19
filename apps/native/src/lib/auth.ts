import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import {
  createNativeAuthClient,
  getNativeAuthCookieHeader,
  type NativeAuthProvider,
} from "@domainstack/auth/native";

import { apiBaseUrl } from "./env";
import { secureAuthStorage } from "./secure-auth-storage";

WebBrowser.maybeCompleteAuthSession();

export const authClient = createNativeAuthClient({
  baseURL: apiBaseUrl,
  storage: secureAuthStorage,
});

export type AuthProvider = NativeAuthProvider;

export async function signInWithProvider(provider: AuthProvider) {
  return authClient.signIn.social({ provider, callbackURL: Linking.createURL("/") });
}

export async function signInWithAppleToken(token: string, nonce?: string) {
  return authClient.signIn.social({
    provider: "apple",
    idToken: { token, nonce },
    callbackURL: Linking.createURL("/"),
  });
}

export async function signInWithGoogleToken(token: string, nonce?: string) {
  return authClient.signIn.social({
    provider: "google",
    idToken: { token, nonce },
    callbackURL: Linking.createURL("/"),
  });
}

export async function linkProvider(provider: AuthProvider) {
  return authClient.linkSocial({
    provider,
    callbackURL: Linking.createURL("/settings"),
  });
}

export async function linkProviderWithAppleToken(token: string, nonce?: string) {
  return authClient.linkSocial({
    provider: "apple",
    idToken: { token, nonce },
    callbackURL: Linking.createURL("/settings"),
  });
}

export async function linkProviderWithGoogleToken(token: string, nonce?: string) {
  return authClient.linkSocial({
    provider: "google",
    idToken: { token, nonce },
    callbackURL: Linking.createURL("/settings"),
  });
}

export async function unlinkProvider(providerId: AuthProvider, accountId?: string) {
  return authClient.unlinkAccount({ providerId, accountId });
}

export async function deleteAccount() {
  return authClient.deleteUser();
}

export function getAuthCookieHeader(): string | null {
  return getNativeAuthCookieHeader(authClient);
}
