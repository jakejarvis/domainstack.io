import type { ComponentType } from "react";
import { GitHubIcon, VercelIcon } from "@/components/brand-icons";

/**
 * OAuth provider configuration for better-auth social providers.
 *
 * To add a new provider:
 * 1. Add the provider config to OAUTH_PROVIDERS
 * 2. Add icon to components/brand-icons.tsx
 * 3. Add env vars (CLIENT_ID, CLIENT_SECRET) to .env.local
 * 4. Update lib/auth.ts socialProviders config
 * 5. Update env var validation in lib/auth.ts
 */

export interface OAuthProviderConfig {
  /** Provider ID used by better-auth (e.g., "github", "google") */
  id: string;
  /** Display name shown in UI */
  name: string;
  /** Icon component for the provider */
  icon: ComponentType<{ className?: string }>;
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
export const OAUTH_PROVIDERS: OAuthProviderConfig[] = [
  {
    id: "github",
    name: "GitHub",
    icon: GitHubIcon,
    enabled: process.env.NEXT_PUBLIC_GITHUB_OAUTH_ENABLED === "true",
  },
  {
    id: "vercel",
    name: "Vercel",
    icon: VercelIcon,
    enabled: process.env.NEXT_PUBLIC_VERCEL_OAUTH_ENABLED === "true",
  },
];

/**
 * Get all enabled OAuth providers.
 */
export function getEnabledProviders(): OAuthProviderConfig[] {
  return OAUTH_PROVIDERS.filter((p) => p.enabled);
}

/**
 * Get provider config by ID.
 */
export function getProviderById(id: string): OAuthProviderConfig | undefined {
  return OAUTH_PROVIDERS.find((p) => p.id === id);
}
