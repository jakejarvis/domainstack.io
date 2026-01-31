import type { OAuthConfig, OAuthCredentials, OAuthProvider } from "./types";

/**
 * Result of building OAuth provider configuration.
 */
export type OAuthProviderResult = {
  /** Provider configs to pass to betterAuth socialProviders */
  providers: Record<string, OAuthCredentials>;
  /** List of enabled provider names for trustedProviders */
  enabledProviders: OAuthProvider[];
};

/**
 * Builds OAuth provider configuration from credentials.
 * Filters out providers with missing or incomplete credentials.
 *
 * @param credentials - Map of provider to credentials (both clientId and clientSecret required)
 * @returns Provider configs and list of enabled providers
 *
 * @example
 * ```ts
 * const { providers, enabledProviders } = buildOAuthProviders({
 *   github: { clientId: "...", clientSecret: "..." },
 *   google: undefined, // disabled
 * });
 *
 * const auth = betterAuth({
 *   socialProviders: providers,
 *   account: {
 *     accountLinking: {
 *       enabled: true,
 *       trustedProviders: enabledProviders,
 *     },
 *   },
 * });
 * ```
 */
export function buildOAuthProviders(
  credentials: OAuthConfig,
): OAuthProviderResult {
  const providers: Record<string, OAuthCredentials> = {};
  const enabledProviders: OAuthProvider[] = [];

  for (const [provider, creds] of Object.entries(credentials)) {
    if (creds?.clientId && creds?.clientSecret) {
      providers[provider] = creds;
      enabledProviders.push(provider as OAuthProvider);
    }
  }

  return { providers, enabledProviders };
}

/**
 * Validates that at least one OAuth provider is configured.
 * Throws an error if no providers have valid credentials.
 *
 * @param credentials - Map of provider to credentials
 * @throws Error if no providers are configured
 */
export function validateOAuthProviders(credentials: OAuthConfig): void {
  const { enabledProviders } = buildOAuthProviders(credentials);

  if (enabledProviders.length === 0) {
    throw new Error(
      "At least one OAuth provider must be configured (GitHub, GitLab, Google, or Vercel)",
    );
  }
}

/**
 * Validates OAuth credentials pair.
 * Throws an error if only one of clientId/clientSecret is provided.
 *
 * @param provider - Provider name for error message
 * @param clientId - OAuth client ID
 * @param clientSecret - OAuth client secret
 * @throws Error if credentials are incomplete
 */
export function validateOAuthCredentialPair(
  provider: string,
  clientId: string | undefined,
  clientSecret: string | undefined,
): void {
  if ((clientId && !clientSecret) || (!clientId && clientSecret)) {
    throw new Error(
      `Both ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET are required when using ${provider} OAuth`,
    );
  }
}
