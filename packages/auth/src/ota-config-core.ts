import { OAUTH_PROVIDER_METADATA } from "./providers";
import type { OAuthProvider } from "./types";

export type OtaConfigAuthProvider = {
  id: OAuthProvider;
  name: string;
};

export type OtaConfigResponse = {
  authProviders: OtaConfigAuthProvider[];
};

export type BuildOtaConfigOptions = {
  enabledProviders: readonly OAuthProvider[];
};

export function buildOtaConfig({ enabledProviders }: BuildOtaConfigOptions): OtaConfigResponse {
  const enabled = new Set<OAuthProvider>(enabledProviders);

  return {
    authProviders: OAUTH_PROVIDER_METADATA.flatMap((provider) =>
      enabled.has(provider.id) ? [{ id: provider.id, name: provider.name }] : [],
    ),
  };
}
