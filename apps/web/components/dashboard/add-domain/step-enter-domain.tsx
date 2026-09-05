import { useEffect, useRef } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@domainstack/ui/field";
import { Input } from "@domainstack/ui/input";

type StepEnterDomainProps = {
  domain: string;
  setDomain: (v: string) => void;
  error: string;
  isLoading: boolean;
  onSubmit: () => void;
  /** Whether the domain input is read-only (e.g., when prefilled from domain report) */
  readOnly?: boolean;
};

export function StepEnterDomain({
  domain,
  setDomain,
  error,
  isLoading,
  onSubmit,
  readOnly = false,
}: StepEnterDomainProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hadErrorRef = useRef(false);

  useEffect(() => {
    if (error && !hadErrorRef.current) {
      inputRef.current?.focus();
    }
    hadErrorRef.current = Boolean(error);
  }, [error]);

  return (
    <Field data-invalid={error ? true : undefined}>
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
        aria-invalid={error ? true : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (!isLoading) {
              onSubmit();
            }
          }
        }}
      />
      <FieldError>{error}</FieldError>
    </Field>
  );
}
