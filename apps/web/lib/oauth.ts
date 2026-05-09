import { SiApple, SiGithub, SiGitlab, SiGoogle, SiVercel } from "@icons-pack/react-simple-icons";

import { OAUTH_PROVIDER_METADATA, type OAuthProviderId } from "@domainstack/auth/providers";

/**
 * OAuth provider display metadata for the web login UI.
 */

export interface OAuthProvider {
  /** Provider ID used by better-auth (e.g., "github", "google") */
  id: OAuthProviderId;
  /** Display name shown in UI */
  name: string;
  /** Icon component for the provider */
  icon: React.ComponentType<{ className?: string }>;
  /** Whether this provider is currently enabled */
  enabled: boolean;
}

/**
 * Note: Use NEXT_PUBLIC_ env vars for the enabled flag since this file
 * is imported in client components. OAuth secrets stay server-side.
 */
const PROVIDER_ICONS: Record<OAuthProviderId, OAuthProvider["icon"]> = {
  apple: SiApple,
  github: SiGithub,
  gitlab: SiGitlab,
  google: SiGoogle,
  vercel: SiVercel,
};

const PROVIDER_ENABLED: Record<OAuthProviderId, boolean> = {
  apple: process.env.NEXT_PUBLIC_APPLE_OAUTH_ENABLED === "true",
  github: process.env.NEXT_PUBLIC_GITHUB_OAUTH_ENABLED === "true",
  gitlab: process.env.NEXT_PUBLIC_GITLAB_OAUTH_ENABLED === "true",
  google: process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true",
  vercel: process.env.NEXT_PUBLIC_VERCEL_OAUTH_ENABLED === "true",
};

const OAUTH_PROVIDERS: OAuthProvider[] = OAUTH_PROVIDER_METADATA.map((provider) => ({
  id: provider.id,
  name: provider.name,
  icon: PROVIDER_ICONS[provider.id],
  enabled: PROVIDER_ENABLED[provider.id],
}));

/**
 * Get all enabled OAuth providers.
 */
export function getEnabledProviders(): OAuthProvider[] {
  return OAUTH_PROVIDERS.filter((p) => p.enabled);
}
