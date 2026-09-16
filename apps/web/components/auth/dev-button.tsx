"use client";

import { useState } from "react";

import { signIn, signUp } from "@domainstack/auth/client";
import { Button } from "@domainstack/ui/button";

const localDeveloper = {
  email: "developer@example.com",
  name: "Local Developer",
  password: "domainstack-local-developer",
};

interface DevButtonProps {
  callbackURL: string;
  onNavigate?: () => void;
}

export function DevButton({ callbackURL, onNavigate }: DevButtonProps) {
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSignIn = async () => {
    try {
      setError(undefined);
      const signInResult = await signIn.email({
        email: localDeveloper.email,
        password: localDeveloper.password,
        callbackURL,
      });
      if (signInResult.error) {
        const signUpResult = await signUp.email({ ...localDeveloper, callbackURL });
        if (signUpResult.error) throw new Error(signUpResult.error.message);
      }
      onNavigate?.();
    } catch (err) {
      console.error(err);
      setError(
        `Failed to sign in as the local developer: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  return (
    <>
      {error ? (
        <p className="text-sm text-destructive-foreground">{error}</p>
      ) : (
        <Button size="lg" variant="outline" className="w-full gap-3" onClick={handleSignIn}>
          Continue as local developer
        </Button>
      )}
    </>
  );
}
