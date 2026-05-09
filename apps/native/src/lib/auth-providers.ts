import {
  OAUTH_PROVIDER_METADATA,
  type OAuthProviderId,
  type OAuthProviderMetadata,
} from "@domainstack/auth/providers";

export type NativeOAuthEnabledMap = Record<OAuthProviderId, boolean>;

export type GoogleNativeAuthConfig = {
  webClientId: string;
  iosClientId: string;
};

export type NativeAuthProviderOption = {
  id: OAuthProviderId;
  name: string;
  supportsNativeIdToken: boolean;
};

export function canUseNativeGoogleAuth(config: GoogleNativeAuthConfig): boolean {
  return config.webClientId.length > 0 && config.iosClientId.length > 0;
}

function canUseProviderIdentityToken(
  provider: OAuthProviderMetadata,
  googleConfig: GoogleNativeAuthConfig,
): boolean {
  if (!provider.supportsNativeIdToken) return false;
  if (provider.id === "google") return canUseNativeGoogleAuth(googleConfig);
  return true;
}

export function getEnabledNativeAuthProviders(
  enabled: NativeOAuthEnabledMap,
  googleConfig: GoogleNativeAuthConfig,
): NativeAuthProviderOption[] {
  return OAUTH_PROVIDER_METADATA.filter((provider) => enabled[provider.id]).map((provider) => ({
    id: provider.id,
    name: provider.name,
    supportsNativeIdToken: canUseProviderIdentityToken(provider, googleConfig),
  }));
}
