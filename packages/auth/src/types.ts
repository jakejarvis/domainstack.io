import type { SocialProviderList } from "better-auth/social-providers";

/**
 * OAuth provider identifiers supported by the auth system.
 */
type BetterAuthSocialProvider = SocialProviderList[number];

export const OAUTH_PROVIDER_IDS = [
  "apple",
  "github",
  "gitlab",
  "google",
  "vercel",
] as const satisfies readonly BetterAuthSocialProvider[];

export type OAuthProvider = (typeof OAUTH_PROVIDER_IDS)[number];

/**
 * OAuth credentials for a provider.
 */
export type OAuthCredentials = {
  clientId: string;
  clientSecret: string;
  appBundleIdentifier?: string;
};

/**
 * OAuth configuration map.
 */
export type OAuthConfig = Partial<Record<OAuthProvider, OAuthCredentials | undefined>>;
