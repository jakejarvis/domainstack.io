"use client";

import { useState } from "react";

import { Button } from "@domainstack/ui/button";
import { Spinner } from "@domainstack/ui/spinner";

interface DevButtonProps {
  callbackURL: string;
  onNavigate?: () => void;
}

export function DevButton({ callbackURL, onNavigate }: DevButtonProps) {
  const [error, setError] = useState<string | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);

  const handleSignIn = async () => {
    try {
      setError(undefined);
      setIsPending(true);
      const response = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ callbackURL }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(result?.message ?? "The local authentication request failed");
      }
      onNavigate?.();
      window.location.assign(callbackURL);
    } catch (err) {
      console.error(err);
      setError(
        `Failed to sign in as the local developer: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      {error ? (
        <p aria-live="polite" className="text-sm text-destructive-foreground">
          {error}
        </p>
      ) : null}
      <Button
        size="lg"
        variant="outline"
        className="w-full gap-3"
        disabled={isPending}
        onClick={handleSignIn}
      >
        {isPending ? <Spinner className="size-5" /> : null}
        Continue as local developer
      </Button>
    </>
  );
}
