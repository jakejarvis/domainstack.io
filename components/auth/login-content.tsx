"use client";

import { ScanFace } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { OAuthButton } from "@/components/auth/oauth-button";
import { Card } from "@/components/ui/card";
import { getEnabledProviders } from "@/lib/constants/oauth-providers";
import { cn } from "@/lib/utils";

interface LoginContentProps {
  /** Whether to show the card wrapper (false for modal usage) */
  showCard?: boolean;
  /** Additional classes for the card wrapper */
  className?: string;
  /** Callback when navigating away (e.g., to close modal) */
  onNavigate?: () => void;
}

export function LoginContent({
  showCard = true,
  className,
  onNavigate,
}: LoginContentProps) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const content = (
    <div className="flex flex-col items-center p-6">
      <div className="mb-5 flex size-14 items-center justify-center rounded-xl bg-primary/5 text-primary">
        <ScanFace className="size-7" strokeWidth={2} />
      </div>
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
          className="underline underline-offset-2 hover:text-foreground"
          onClick={onNavigate}
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="underline underline-offset-2 hover:text-foreground"
          onClick={onNavigate}
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card
      className={cn(
        "w-full max-w-sm overflow-hidden rounded-3xl",
        "border-black/10 bg-background/80 backdrop-blur-xl",
        "supports-[backdrop-filter]:bg-background/80 dark:border-white/10",
        className,
      )}
    >
      {content}
    </Card>
  );
}
