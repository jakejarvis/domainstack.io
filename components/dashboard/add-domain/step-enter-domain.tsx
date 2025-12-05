"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
          aria-invalid={!!error}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (domain.trim().length > 0 && !isLoading) {
                onSubmit();
              }
            }
          }}
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
      <p className="text-muted-foreground text-sm">
        Enter the domain you want to track. You&apos;ll need to verify ownership
        in the next step.
      </p>
    </div>
  );
}
