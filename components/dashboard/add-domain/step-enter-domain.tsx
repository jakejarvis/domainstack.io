"use client";

import { useMemo } from "react";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isValidDomain, normalizeDomainInput } from "@/lib/domain";

type StepEnterDomainProps = {
  domain: string;
  setDomain: (v: string) => void;
  error: string;
  isLoading: boolean;
  onSubmit: () => void;
  /** Whether the user has attempted to submit (controlled by parent) */
  hasAttemptedSubmit: boolean;
  /** Whether the domain input is read-only (e.g., when prefilled from domain report) */
  readOnly?: boolean;
};

export function StepEnterDomain({
  domain,
  setDomain,
  error,
  isLoading,
  onSubmit,
  hasAttemptedSubmit,
  readOnly = false,
}: StepEnterDomainProps) {
  // Client-side validation
  const clientError = useMemo(() => {
    if (!domain.trim()) return "";
    const normalized = normalizeDomainInput(domain);
    if (!isValidDomain(normalized)) {
      return "Please enter a valid domain name";
    }
    return "";
  }, [domain]);

  // Only show client error after user has attempted to submit
  // Always show server errors immediately
  const displayError = error || (hasAttemptedSubmit ? clientError : "");
  const canSubmit = domain.trim().length > 0 && !isLoading && !clientError;

  return (
    <Field data-invalid={!!displayError || undefined}>
      <FieldLabel htmlFor="add-domain-input">Domain name</FieldLabel>
      <Input
        id="add-domain-input"
        placeholder="example.com"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        disabled={isLoading}
        readOnly={readOnly}
        inputMode="url"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={!!displayError}
        className={readOnly ? "cursor-default opacity-70" : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (canSubmit) {
              onSubmit();
            }
          }
        }}
      />
      <FieldError>{displayError}</FieldError>
      <FieldDescription>
        {readOnly
          ? "This domain will be added to your tracking list. Continue to verify ownership."
          : "Enter the domain you want to track. You'll need to verify ownership in the next step."}
      </FieldDescription>
    </Field>
  );
}
