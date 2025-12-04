"use client";

import { useState } from "react";
import { GitHubIcon } from "@/components/brand-icons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { signIn } from "@/lib/auth-client";

export function SignInButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn.social({
        provider: "github",
        callbackURL: "/dashboard",
      });
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <Button
      size="lg"
      className="w-full gap-3 transition-transform active:scale-[0.98]"
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
          <GitHubIcon className="size-5" />
          Continue with GitHub
        </>
      )}
    </Button>
  );
}
