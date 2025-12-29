"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAnalytics } from "@/lib/analytics/client";
import { signIn } from "@/lib/auth-client";
import type { OAuthProviderConfig } from "@/lib/constants/oauth-providers";
import { logger } from "@/lib/logger/client";
import { cn } from "@/lib/utils";

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
  callbackURL,
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

    // Reset loading state if user returns to page (e.g., via back button)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        onLoadingChange?.(false);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    try {
      await signIn.social({
        provider: provider.id,
        callbackURL,
        // On OAuth errors, redirect to login page where errors are displayed
        errorCallbackURL: "/login",
      });
      // Don't reset loading here - let it persist during navigation
      // It will be reset if user returns via back button
    } catch (err) {
      // Only reset on actual error
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      onLoadingChange?.(false);
      logger.error(`${provider.name} sign-in failed`, err, {
        provider: provider.id,
      });
      toast.error(`Failed to sign in with ${provider.name}.`, {
        description: "Please try again or choose a different provider.",
      });
    }
  };

  return (
    <Button
      size="lg"
      variant="outline"
      className={cn("w-full cursor-pointer gap-3 leading-none", className)}
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
