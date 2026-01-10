import {
  SiGithub,
  SiGitlab,
  SiGoogle,
  SiVercel,
} from "@icons-pack/react-simple-icons";

/**
 * OAuth provider constants for better-auth social providers.
 *
 * To add a new provider:
 * 1. Add the provider config to OAUTH_PROVIDERS
 * 2. Add env vars (CLIENT_ID, CLIENT_SECRET) to .env.local
 * 3. Update lib/auth.ts socialProviders config
 * 4. Update env var validation in lib/auth.ts
 */

export interface OAuthProvider {
  /** Provider ID used by better-auth (e.g., "github", "google") */
  id: string;
  /** Display name shown in UI */
  name: string;
  /** Icon component for the provider */
  icon: React.ComponentType<{ className?: string }>;
  /** Whether this provider is currently enabled */
  enabled: boolean;
}

/**
 * All supported OAuth providers.
 * Only providers with enabled: true will be shown in the UI.
 *
 * Note: Use NEXT_PUBLIC_ env vars for the enabled flag since this file
 * is imported in client components. The actual OAuth secrets are kept
 * server-side in lib/auth.ts.
 */
const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    id: "github",
    name: "GitHub",
    icon: SiGithub,
    enabled: process.env.NEXT_PUBLIC_GITHUB_OAUTH_ENABLED === "true",
  },
  {
    id: "gitlab",
    name: "GitLab",
    icon: SiGitlab,
    enabled: process.env.NEXT_PUBLIC_GITLAB_OAUTH_ENABLED === "true",
  },
  {
    id: "google",
    name: "Google",
    icon: SiGoogle,
    enabled: process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true",
  },
  {
    id: "vercel",
    name: "Vercel",
    icon: SiVercel,
    enabled: process.env.NEXT_PUBLIC_VERCEL_OAUTH_ENABLED === "true",
  },
];

/**
 * Get all enabled OAuth providers.
 */
export function getEnabledProviders(): OAuthProvider[] {
  return OAUTH_PROVIDERS.filter((p) => p.enabled);
}
