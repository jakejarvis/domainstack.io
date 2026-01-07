/**
 * OAuth provider types.
 *
 * Constants are in @/lib/constants/oauth-providers.ts.
 */

import type { ComponentType } from "react";

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
