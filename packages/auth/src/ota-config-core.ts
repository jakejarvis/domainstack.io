import { OAUTH_PROVIDER_METADATA } from "./providers";
import type { OAuthProvider } from "./types";

export type OtaConfigAuthProvider = {
  id: OAuthProvider;
  name: string;
};

/**
 * Native app gating config. When present, native clients enforce a hard
 * version gate and route to the platform store when they fall below
 * `minVersion`. `null` disables the gate entirely.
 */
export interface OtaConfigNativeApp {
  minVersion: string;
  storeUrlIos: string;
  storeUrlAndroid: string;
  messageTitle?: string;
  messageBody?: string;
}

export type OtaConfigResponse = {
  authProviders: OtaConfigAuthProvider[];
  nativeApp: OtaConfigNativeApp | null;
};

export type BuildOtaConfigOptions = {
  enabledProviders: readonly OAuthProvider[];
  nativeApp: OtaConfigNativeApp | null;
};

export function buildOtaConfig({
  enabledProviders,
  nativeApp,
}: BuildOtaConfigOptions): OtaConfigResponse {
  const enabled = new Set<OAuthProvider>(enabledProviders);

  return {
    authProviders: OAUTH_PROVIDER_METADATA.flatMap((provider) =>
      enabled.has(provider.id) ? [{ id: provider.id, name: provider.name }] : [],
    ),
    nativeApp,
  };
}
