"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAnalytics } from "@/lib/analytics/client";
import { signIn } from "@/lib/auth-client";
import type { OAuthProviderConfig } from "@/lib/constants/oauth-providers";
import { logger } from "@/lib/logger/client";

interface OAuthButtonProps {
  /** Provider configuration */
  provider: OAuthProviderConfig;
  /** URL to redirect to after successful sign-in */
  callbackURL?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Generic OAuth sign-in button that works with any configured provider.
 *
 * Usage:
 * ```tsx
 * import { getEnabledProviders } from "@/lib/constants/oauth-providers";
 *
 * // Render buttons for all enabled providers
 * {getEnabledProviders().map((provider) => (
 *   <OAuthButton key={provider.id} provider={provider} />
 * ))}
 * ```
 */
export function OAuthButton({
  provider,
  callbackURL = "/dashboard",
  className,
}: OAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const analytics = useAnalytics();
  const Icon = provider.icon;

  const handleSignIn = async () => {
    setIsLoading(true);
    analytics.track("sign_in_clicked", { provider: provider.id });

    try {
      await signIn.social({
        provider: provider.id,
        callbackURL,
      });
      // Don't reset loading state on success - the page will redirect
      // and we want to keep the loading state until navigation completes
    } catch (err) {
      logger.error(`${provider.name} sign-in failed`, err, {
        provider: provider.id,
      });
      // Only reset loading state on error so user can retry
      setIsLoading(false);
    }
  };

  return (
    <Button
      size="lg"
      className={`w-full cursor-pointer gap-3 transition-transform active:scale-[0.98] ${className ?? ""}`}
      onClick={handleSignIn}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Spinner className="size-5" />
          Signing in...
        </>
      ) : (
        <>
          <Icon className="size-5" />
          Continue with {provider.name}
        </>
      )}
    </Button>
  );
}
