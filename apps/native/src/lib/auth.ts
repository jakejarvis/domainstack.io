import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
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

export async function signInWithGoogleToken(token: string, nonce?: string) {
  return signInWithGoogleIdentityToken(authClient, token, Linking.createURL("/"), nonce);
}

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

export async function signOut() {
  return authClient.signOut();
}

export function getAuthCookieHeader(): string | null {
  return getNativeAuthCookieHeader(authClient);
}
