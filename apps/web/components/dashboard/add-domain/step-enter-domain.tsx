import { useMemo, useEffect, useRef } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@domainstack/ui/field";
import { Input } from "@domainstack/ui/input";
import { isValidDomain, normalizeDomainInput } from "@domainstack/utils/domain/client";

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
      return "Enter a valid domain, like example.com (no https://).";
    }
    return "";
  }, [domain]);

  // Only show client error after user has attempted to submit
  // Always show server errors immediately
  const displayError = error || (hasAttemptedSubmit ? clientError : "");
  const canSubmit = domain.trim().length > 0 && !isLoading && !clientError;
  const inputRef = useRef<HTMLInputElement>(null);
  const hadErrorRef = useRef(false);

  useEffect(() => {
    if (displayError && !hadErrorRef.current) {
      inputRef.current?.focus();
    }
    hadErrorRef.current = Boolean(displayError);
  }, [displayError]);

  return (
    <Field data-invalid={!!displayError || undefined}>
      <FieldLabel className="sr-only">Domain name</FieldLabel>
      <FieldDescription>
        {readOnly
          ? "This domain will be added to your tracking list. Continue to verify ownership."
          : "Enter the domain you want to track. You\u2019ll need to verify ownership in the next step."}
      </FieldDescription>
      <Input
        ref={inputRef}
        name="domain"
        placeholder="example.com\u2026"
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
    </Field>
  );
}
