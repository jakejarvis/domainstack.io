"use client";

import { Icon } from "@domainstack/ui/icon";
import { cn } from "@domainstack/ui/utils";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { OAuthButton } from "@/components/auth/oauth-button";
import { Logo } from "@/components/logo";
import { useAuthCallback } from "@/hooks/use-auth-callback";
import { getEnabledProviders } from "@/lib/oauth";

interface LoginContentProps {
  /** Additional classes for the wrapper */
  className?: string;
  /** Callback when navigating away (e.g., to close modal) */
  onNavigate?: () => void;
  /** URL to redirect to after successful sign-in (defaults to current page or /dashboard) */
  callbackURL?: string;
}

export function LoginContent({
  className,
  onNavigate,
  callbackURL,
}: LoginContentProps) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Handle auth callback errors (e.g., OAuth failures redirect here with ?error=...)
  useAuthCallback();

  // Use provided callback URL, or auto-detect current page
  // After OAuth completes, better-auth redirects to this URL
  // Special cases: homepage (/) and /login page redirect to /dashboard
  const effectiveCallbackURL =
    callbackURL ??
    (["/", "/login"].includes(pathname)
      ? "/dashboard"
      : pathname +
        (searchParams.toString() ? `?${searchParams.toString()}` : ""));

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <Icon size="xl" variant="muted" className="mb-5">
        <Logo />
      </Icon>
      <h1 className="mb-2 font-semibold text-xl tracking-tight">
        Welcome to Domainstack
      </h1>
      <p className="mb-6 text-center text-muted-foreground text-sm">
        Sign in to track your domains and receive health alerts.
      </p>
      <div className="flex w-full flex-col gap-3">
        {getEnabledProviders().map((provider) => (
          <OAuthButton
            key={provider.id}
            provider={provider}
            callbackURL={effectiveCallbackURL}
            isLoading={loadingProvider === provider.id}
            isAnyLoading={loadingProvider !== null}
            onLoadingChange={(loading) =>
              setLoadingProvider(loading ? provider.id : null)
            }
          />
        ))}
      </div>
      <p className="mt-6 text-center text-muted-foreground text-xs leading-relaxed">
        By signing in, you agree to our{" "}
        <Link
          href="/terms"
          onClick={onNavigate}
          className="underline underline-offset-2 hover:text-foreground"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          onClick={onNavigate}
          className="underline underline-offset-2 hover:text-foreground"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
