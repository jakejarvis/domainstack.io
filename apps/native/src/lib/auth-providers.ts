import type { RouterOutputs } from "@domainstack/api";
import {
  OAUTH_PROVIDER_METADATA,
  type OAuthProviderId,
  type OAuthProviderMetadata,
} from "@domainstack/auth/providers";

/** A configured OAuth provider as returned by the `auth.getOauthProviders` tRPC procedure. */
export type AuthProviderSummary = RouterOutputs["auth"]["getOauthProviders"][number];

export type NativeAuthPlatform = "android" | "ios" | "web" | "macos" | "windows";

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

/**
 * Provider list used when `auth.getOauthProviders` can't be reached (offline,
 * DNS/TLS failure, server error). Offering the full set the app supports keeps
 * users from being locked out of sign-in: a provider the server hasn't actually
 * enabled just surfaces its own error at sign-in time, which is recoverable — a
 * blank screen is not.
 */
export const FALLBACK_AUTH_PROVIDERS: readonly AuthProviderSummary[] = OAUTH_PROVIDER_METADATA.map(
  ({ id, name }) => ({ id, name }),
);

export function canUseNativeGoogleAuthOnPlatform(
  config: GoogleNativeAuthConfig,
  platform: NativeAuthPlatform,
): boolean {
  if (config.webClientId.length === 0) return false;
  if (platform === "android") return true;
  if (platform === "ios") return config.iosClientId.length > 0;
  return false;
}

function canUseProviderIdentityToken(
  provider: OAuthProviderMetadata,
  googleConfig: GoogleNativeAuthConfig,
  appleAuthAvailable: boolean,
  platform: NativeAuthPlatform,
): boolean {
  if (!provider.supportsNativeIdToken) return false;
  if (provider.id === "apple") return appleAuthAvailable;
  if (provider.id === "google") return canUseNativeGoogleAuthOnPlatform(googleConfig, platform);
  return true;
}

export function getEnabledNativeAuthProviders(
  authProviders: readonly AuthProviderSummary[],
  googleConfig: GoogleNativeAuthConfig,
  options: { appleAuthAvailable?: boolean; platform?: NativeAuthPlatform } = {},
): NativeAuthProviderOption[] {
  const platform = options.platform ?? "ios";

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
          platform,
        ),
      },
    ];
  });
}
