"use client";

import posthogClient from "posthog-js";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SettingsCard } from "@/components/settings/settings-card";
import { EMAIL_CHANGE_PARAM } from "@/hooks/use-email-change-callback";
import { changeEmail } from "@domainstack/auth/client";
import { Button } from "@domainstack/ui/button";
import { Field, FieldError, FieldLabel } from "@domainstack/ui/field";
import { Input } from "@domainstack/ui/input";
import { Spinner } from "@domainstack/ui/spinner";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Inline error for the new-address field, or "" when it can be sent. */
function validateNewEmail(value: string, current: string): string {
  if (!value) return "Enter an email address, like you@example.com.";
  if (!EMAIL_PATTERN.test(value)) return "Enter a valid email address, like you@example.com.";
  if (value.toLowerCase() === current.toLowerCase()) return "That's already your email address.";
  return "";
}

/** Toast description for a failed send. Plan 136 allows 5 requests per hour. */
function sendErrorDescription(status: number | undefined): string {
  if (status === 429) return "You've asked for too many links. Try again in an hour.";
  if (status === 401) return "Your session expired. Sign in again, then retry.";
  return "Please try again.";
}

type CardState =
  | { status: "idle" }
  | { status: "editing" }
  | { status: "sending" }
  | { status: "sent"; newEmail: string };

export function EmailAddressCard({ email }: { email: string }) {
  const [state, setState] = useState<CardState>({ status: "idle" });
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const sentMessageRef = useRef<HTMLDivElement>(null);
  const previousStatusRef = useRef(state.status);

  // Each view replaces the focused control, so move focus with it: to the field
  // when the form opens (or a send fails), to the confirmation message after a
  // send, and back to Change when the form or message closes.
  useEffect(() => {
    const previous = previousStatusRef.current;
    previousStatusRef.current = state.status;
    if (state.status === "editing") inputRef.current?.focus();
    else if (state.status === "sent") sentMessageRef.current?.focus();
    else if (state.status === "idle" && previous !== "idle") changeButtonRef.current?.focus();
  }, [state.status]);

  const close = () => {
    setState({ status: "idle" });
    setValue("");
    setError("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const newEmail = value.trim();
    const problem = validateNewEmail(newEmail, email);
    if (problem) {
      setError(problem);
      inputRef.current?.focus();
      return;
    }
    setError("");
    setState({ status: "sending" });

    const fail = (err: unknown, status?: number) => {
      posthogClient.captureException(err, { action: "change_email" });
      toast.error("Couldn't send the confirmation link.", {
        description: sendErrorDescription(status),
      });
      setState({ status: "editing" });
    };

    let result: Awaited<ReturnType<typeof changeEmail>>;
    try {
      result = await changeEmail({
        newEmail,
        callbackURL: `/settings/account?${EMAIL_CHANGE_PARAM}=1`,
      });
    } catch (err) {
      fail(err);
      return;
    }
    if (result.error) {
      fail(
        new Error(result.error.message ?? `change email failed (${result.error.status})`),
        result.error.status,
      );
      return;
    }
    setState({ status: "sent", newEmail });
    setValue("");
  };

  const isSending = state.status === "sending";

  return (
    <SettingsCard title="Email Address" description="Alerts and account emails go to this address.">
      {state.status === "sent" ? (
        <div className="space-y-3 text-[13px]">
          <div
            ref={sentMessageRef}
            tabIndex={-1}
            role="status"
            className="space-y-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p>
              We sent a confirmation link to{" "}
              <span className="font-semibold break-all">{state.newEmail}</span>. Open it in this
              browser within 1&nbsp;hour to finish. Until then, emails still go to{" "}
              <span className="font-semibold break-all">{email}</span>.
            </p>
            <p className="text-muted-foreground">
              Nothing arrived? Check your spam folder. If it still doesn&rsquo;t show up, that
              address may already belong to another Domainstack account.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={close}>
            Done
          </Button>
        </div>
      ) : state.status === "idle" ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
          <span className="min-w-0 truncate text-sm font-medium" title={email}>
            {email}
          </span>
          <Button
            ref={changeButtonRef}
            variant="outline"
            size="sm"
            aria-label="Change email address"
            onClick={() => setState({ status: "editing" })}
          >
            Change
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel>New email address</FieldLabel>
            <Input
              ref={inputRef}
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              placeholder="you@example.com…"
              value={value}
              onChange={(e) => {
                setError("");
                setValue(e.target.value);
              }}
              disabled={isSending}
              aria-invalid={error ? true : undefined}
            />
            <FieldError>{error}</FieldError>
          </Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSending}>
              {isSending && <Spinner />}
              {isSending ? "Sending…" : "Send confirmation link"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={close} disabled={isSending}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </SettingsCard>
  );
}
