import type { OtaConfigAuthProvider } from "@domainstack/auth/ota-config/client";
import {
  OAUTH_PROVIDER_METADATA,
  type OAuthProviderId,
  type OAuthProviderMetadata,
} from "@domainstack/auth/providers";

export type GoogleNativeAuthConfig = {
  webClientId: string;
  iosClientId: string;
};

export type NativeAuthProviderOption = {
  id: OAuthProviderId;
  name: string;
  supportsNativeIdToken: boolean;
};

const providerMetadataById = new Map<OAuthProviderId, OAuthProviderMetadata>(
  OAUTH_PROVIDER_METADATA.map((provider) => [provider.id, provider]),
);

export function canUseNativeGoogleAuth(config: GoogleNativeAuthConfig): boolean {
  return config.webClientId.length > 0 && config.iosClientId.length > 0;
}

function canUseProviderIdentityToken(
  provider: OAuthProviderMetadata,
  googleConfig: GoogleNativeAuthConfig,
  appleAuthAvailable: boolean,
): boolean {
  if (!provider.supportsNativeIdToken) return false;
  if (provider.id === "apple") return appleAuthAvailable;
  if (provider.id === "google") return canUseNativeGoogleAuth(googleConfig);
  return true;
}

export function getEnabledNativeAuthProviders(
  authProviders: readonly OtaConfigAuthProvider[],
  googleConfig: GoogleNativeAuthConfig,
  options: { appleAuthAvailable?: boolean } = {},
): NativeAuthProviderOption[] {
  return authProviders.flatMap((provider) => {
    const metadata = providerMetadataById.get(provider.id);
    if (!metadata) return [];

    return [
      {
        id: provider.id,
        name: provider.name,
        supportsNativeIdToken: canUseProviderIdentityToken(
          metadata,
          googleConfig,
          options.appleAuthAvailable === true,
        ),
      },
    ];
  });
}
