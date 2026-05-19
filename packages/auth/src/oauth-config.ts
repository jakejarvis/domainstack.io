import { OAUTH_PROVIDER_METADATA } from "./providers";
import type { OAuthProvider } from "./types";

export type OAuthProviderSummary = {
  id: OAuthProvider;
  name: string;
};

function isProviderConfigured(id: OAuthProvider): boolean {
  switch (id) {
    case "apple":
      // Apple's "client secret" is a JWT minted at runtime from the APPLE_*
      // signing keys, so enablement is keyed solely on APPLE_CLIENT_ID — this
      // mirrors `buildAppleCredentials()` in server.ts (the other APPLE_* vars
      // are validated there, not a precondition for the provider showing up).
      return Boolean(process.env.APPLE_CLIENT_ID);
    case "github":
      return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
    case "gitlab":
      return Boolean(process.env.GITLAB_CLIENT_ID && process.env.GITLAB_CLIENT_SECRET);
    case "google":
      return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    case "vercel":
      return Boolean(process.env.VERCEL_CLIENT_ID && process.env.VERCEL_CLIENT_SECRET);
  }
}

/**
 * OAuth providers with complete credentials in the environment, in Domainstack
 * display order. Pure and side-effect-free (no JWT signing or I/O), so it is
 * safe to call per-request from a tRPC procedure as well as once at auth-server
 * construction — making it the single source of truth for provider enablement.
 */
export function getEnabledOAuthProviders(): OAuthProviderSummary[] {
  return OAUTH_PROVIDER_METADATA.flatMap((provider) =>
    isProviderConfigured(provider.id) ? [{ id: provider.id, name: provider.name }] : [],
  );
}
