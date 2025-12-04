"use client";

import { SignInButton } from "@/components/auth/sign-in-button";
import { Logo } from "@/components/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface LoginContentProps {
  /** Whether to show the card wrapper (false for modal usage) */
  showCard?: boolean;
}

export function LoginContent({ showCard = true }: LoginContentProps) {
  const content = (
    <>
      <CardHeader className="text-center">
        <Logo className="mx-auto mb-4 size-12" />
        <CardTitle className="text-xl">Welcome to DomainStack</CardTitle>
        <CardDescription>
          Sign in to track your domains and receive expiration alerts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignInButton />
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-center text-muted-foreground text-xs">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </CardFooter>
    </>
  );

  if (!showCard) {
    return <div className="flex flex-col">{content}</div>;
  }

  return (
    <Card className="w-full max-w-sm rounded-3xl border-black/10 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 dark:border-white/10">
      {content}
    </Card>
  );
}
