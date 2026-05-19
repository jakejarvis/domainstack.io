import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";

import {
  AUTH_SCHEME,
  AUTH_STORAGE_PREFIX,
  getAuthCookieHeader,
  NATIVE_ID_TOKEN_AUTH_PROVIDERS,
  NATIVE_AUTH_PROVIDERS,
  normalizeBaseUrl,
} from "./client-core";
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

export type NativeAuthClient = ReturnType<typeof createAuthClient> & {
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
    ],
  }) as NativeAuthClient;
}

export function getNativeAuthCookieHeader(client: NativeAuthClient): string | null {
  return getAuthCookieHeader(client);
}

export { AUTH_SCHEME, AUTH_STORAGE_PREFIX, NATIVE_AUTH_PROVIDERS, NATIVE_ID_TOKEN_AUTH_PROVIDERS };
export type { NativeAuthProvider, NativeIdTokenAuthProvider } from "./client-core";
