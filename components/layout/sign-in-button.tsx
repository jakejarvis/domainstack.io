"use client";

import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";

export function SignInButton() {
  const handleSignIn = () => {
    signIn.social({
      provider: "github",
      callbackURL: window.location.href,
    });
  };

  return (
    <Button onClick={handleSignIn} size="sm" variant="default">
      Sign in with GitHub
    </Button>
  );
}
