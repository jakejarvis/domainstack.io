import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";

import {
  AUTH_SCHEME,
  AUTH_STORAGE_PREFIX,
  getAuthCookieHeader,
  NATIVE_ID_TOKEN_AUTH_PROVIDERS,
  NATIVE_AUTH_PROVIDERS,
  normalizeBaseUrl,
  type NativeIdTokenAuthProvider,
  type NativeAuthProvider,
} from "./client-core";
import { otaConfigClient, type OtaConfigClientActions } from "./ota-config-client";

export type NativeAuthStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => unknown;
};

export type CreateNativeAuthClientOptions = {
  baseURL: string;
  scheme?: string;
  storage: NativeAuthStorage;
  storagePrefix?: string;
};

export type NativeAuthClient = ReturnType<typeof createAuthClient> &
  OtaConfigClientActions & {
    getCookie: () => string;
  };

export function createNativeAuthClient({
  baseURL,
  scheme = AUTH_SCHEME,
  storage,
  storagePrefix = AUTH_STORAGE_PREFIX,
}: CreateNativeAuthClientOptions): NativeAuthClient {
  return createAuthClient({
    baseURL: normalizeBaseUrl(baseURL),
    plugins: [
      expoClient({
        scheme,
        storage,
        storagePrefix,
      }),
      otaConfigClient(),
    ],
  }) as NativeAuthClient;
}

export async function signInWithNativeProvider(
  client: NativeAuthClient,
  provider: NativeAuthProvider,
  callbackURL: string,
) {
  return client.signIn.social({
    provider,
    callbackURL,
  });
}

export async function signInWithAppleIdentityToken(
  client: NativeAuthClient,
  token: string,
  callbackURL: string,
  nonce?: string,
) {
  return signInWithProviderIdentityToken(client, "apple", token, callbackURL, nonce);
}

export async function signInWithGoogleIdentityToken(
  client: NativeAuthClient,
  token: string,
  callbackURL: string,
  nonce?: string,
) {
  return signInWithProviderIdentityToken(client, "google", token, callbackURL, nonce);
}

export async function signInWithProviderIdentityToken(
  client: NativeAuthClient,
  provider: NativeIdTokenAuthProvider,
  token: string,
  callbackURL: string,
  nonce?: string,
) {
  return client.signIn.social({
    provider,
    idToken: {
      token,
      nonce,
    },
    callbackURL,
  });
}

export function getNativeAuthCookieHeader(client: NativeAuthClient): string | null {
  return getAuthCookieHeader(client);
}

export { AUTH_SCHEME, AUTH_STORAGE_PREFIX, NATIVE_AUTH_PROVIDERS, NATIVE_ID_TOKEN_AUTH_PROVIDERS };
export type { NativeAuthProvider, NativeIdTokenAuthProvider } from "./client-core";
