"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { signIn } from "@domainstack/auth/client";
import { Button } from "@domainstack/ui/button";
import { Field, FieldError, FieldLabel } from "@domainstack/ui/field";
import { Input } from "@domainstack/ui/input";
import { Spinner } from "@domainstack/ui/spinner";

interface DevSignInFormProps {
  /** URL to navigate to after a successful sign-in */
  callbackURL: string;
  /** Callback when navigating away (e.g., to close modal) */
  onNavigate?: () => void;
}

/**
 * Email/password sign-in for local development only. The server enables
 * Better Auth's email/password provider only when NODE_ENV is "development";
 * accounts come from `pnpm db:seed`.
 */
export function DevSignInForm({ callbackURL, onNavigate }: DevSignInFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" ? value : "";
    };

    setError(null);
    setIsPending(true);
    const { error: signInError } = await signIn.email({
      email: field("email").trim(),
      password: field("password"),
    });

    if (signInError) {
      setIsPending(false);
      setError(signInError.message ?? "Sign-in failed. Did you run `pnpm db:seed`?");
      return;
    }

    onNavigate?.();
    router.push(callbackURL);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-3 rounded-lg border border-dashed p-3"
    >
      <p className="text-xs font-medium text-muted-foreground">Dev sign-in (local only)</p>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel>Email</FieldLabel>
        <Input
          name="email"
          type="email"
          autoComplete="username"
          spellCheck={false}
          defaultValue="free@dev.local"
          placeholder="free@dev.local…"
        />
      </Field>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel>Password</FieldLabel>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          defaultValue="password123"
        />
        <FieldError>{error}</FieldError>
      </Field>
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending && <Spinner />}
        Sign in
      </Button>
    </form>
  );
}
