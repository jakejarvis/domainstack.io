import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import {
  createNativeAuthClient,
  getNativeAuthCookieHeader,
  signInWithAppleIdentityToken,
  signInWithGoogleIdentityToken,
  signInWithNativeProvider,
  type NativeAuthProvider,
} from "@domainstack/auth/native";
import type { OtaConfigResponse } from "@domainstack/auth/ota-config/client";

import { apiBaseUrl } from "./env";
import { secureAuthStorage } from "./secure-auth-storage";

WebBrowser.maybeCompleteAuthSession();

export const authClient = createNativeAuthClient({
  baseURL: apiBaseUrl,
  storage: secureAuthStorage,
});

export type AuthProvider = NativeAuthProvider;

export async function signInWithProvider(provider: AuthProvider) {
  return signInWithNativeProvider(authClient, provider, Linking.createURL("/"));
}

export async function signInWithAppleToken(token: string, nonce?: string) {
  return signInWithAppleIdentityToken(authClient, token, Linking.createURL("/"), nonce);
}

export async function signInWithGoogleToken(token: string, nonce?: string) {
  return signInWithGoogleIdentityToken(authClient, token, Linking.createURL("/"), nonce);
}

export const OTA_CONFIG_QUERY_KEY = ["auth", "ota-config"] as const;

export async function getOtaConfig(): Promise<OtaConfigResponse> {
  const result = await authClient.otaConfig.config();
  if (result.error) {
    throw new Error(result.error.message ?? "Unable to load sign-in options.");
  }
  if (!result.data) {
    throw new Error("Unable to load sign-in options.");
  }
  return result.data;
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
