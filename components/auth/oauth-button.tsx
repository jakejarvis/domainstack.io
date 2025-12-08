"use client";

import { toast } from "sonner";
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
  /** Whether this button is loading */
  isLoading?: boolean;
  /** Whether any OAuth button is loading (disables all buttons) */
  isAnyLoading?: boolean;
  /** Callback when loading state changes */
  onLoadingChange?: (loading: boolean) => void;
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
  isLoading = false,
  isAnyLoading = false,
  onLoadingChange,
}: OAuthButtonProps) {
  const analytics = useAnalytics();
  const Icon = provider.icon;

  const handleSignIn = async () => {
    onLoadingChange?.(true);
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
      toast.error(`Failed to sign in with ${provider.name}. Please try again.`);
      // Only reset loading state on error so user can retry
      onLoadingChange?.(false);
    }
  };

  return (
    <Button
      size="lg"
      variant="outline"
      className={`w-full cursor-pointer gap-3 transition-transform active:scale-[0.98] ${className ?? ""}`}
      onClick={handleSignIn}
      disabled={isAnyLoading}
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
