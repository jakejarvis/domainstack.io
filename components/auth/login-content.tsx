"use client";

import Link from "next/link";
import { SignInButton } from "@/components/auth/sign-in-button";
import { Logo } from "@/components/logo";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface LoginContentProps {
  /** Whether to show the card wrapper (false for modal usage) */
  showCard?: boolean;
  /** Additional classes for the card wrapper */
  className?: string;
}

export function LoginContent({
  showCard = true,
  className,
}: LoginContentProps) {
  const content = (
    <div className="flex flex-col items-center px-6 py-8">
      <Logo className="mb-6 size-14" />
      <h1 className="mb-2 font-semibold text-xl tracking-tight">
        Welcome to Domainstack
      </h1>
      <p className="mb-8 text-center text-muted-foreground text-sm">
        Sign in to track your domains and receive expiration alerts.
      </p>
      <div className="w-full">
        <SignInButton />
      </div>
      <p className="mt-6 text-center text-muted-foreground text-xs leading-relaxed">
        By signing in, you agree to our{" "}
        <Link
          href="/terms"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="underline underline-offset-2 hover:text-foreground"
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
