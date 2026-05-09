import { OAUTH_PROVIDER_IDS, type OAuthProvider } from "./types";

export const AUTH_SCHEME = "domainstack";
export const AUTH_STORAGE_PREFIX = "domainstack";

export const NATIVE_AUTH_PROVIDERS = OAUTH_PROVIDER_IDS;
export const NATIVE_ID_TOKEN_AUTH_PROVIDERS = [
  "apple",
  "google",
] as const satisfies readonly OAuthProvider[];

export type NativeAuthProvider = OAuthProvider;
export type NativeIdTokenAuthProvider = (typeof NATIVE_ID_TOKEN_AUTH_PROVIDERS)[number];

export type AuthCookieSource = {
  getCookie: () => string | null | undefined;
};

export function normalizeBaseUrl(baseURL: string | null | undefined): string | undefined {
  const trimmed = baseURL?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\/+$/, "");
}

export function getAuthCookieHeader(source: AuthCookieSource): string | null {
  const cookie = source.getCookie();
  return cookie && cookie.length > 0 ? cookie : null;
}
