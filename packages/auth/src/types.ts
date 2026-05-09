/**
 * OAuth provider identifiers supported by the auth system.
 */
export type OAuthProvider = "apple" | "github" | "gitlab" | "google" | "vercel";

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
