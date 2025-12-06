"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidDomain, normalizeDomainInput } from "@/lib/domain";

type StepEnterDomainProps = {
  domain: string;
  setDomain: (v: string) => void;
  error: string;
  isLoading: boolean;
  onSubmit: () => void;
};

export function StepEnterDomain({
  domain,
  setDomain,
  error,
  isLoading,
  onSubmit,
}: StepEnterDomainProps) {
  // Client-side validation for immediate feedback
  const clientError = useMemo(() => {
    if (!domain.trim()) return "";
    const normalized = normalizeDomainInput(domain);
    if (!isValidDomain(normalized)) {
      return "Please enter a valid domain name";
    }
    return "";
  }, [domain]);

  // Show server error first, then client error
  const displayError = error || clientError;
  const canSubmit = domain.trim().length > 0 && !isLoading && !clientError;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="domain">Domain name</Label>
        <Input
          id="domain"
          placeholder="example.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          disabled={isLoading}
          inputMode="url"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={!!displayError}
          aria-describedby={displayError ? "domain-error" : undefined}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (canSubmit) {
                onSubmit();
              }
            }
          }}
        />
        {displayError && (
          <p id="domain-error" className="text-destructive text-sm">
            {displayError}
          </p>
        )}
      </div>
      <p className="text-muted-foreground text-sm">
        Enter the domain you want to track. You&apos;ll need to verify ownership
        in the next step.
      </p>
    </div>
  );
}
