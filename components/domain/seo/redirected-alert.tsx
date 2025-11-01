"use client";

import { Milestone } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function RedirectedAlert({
  domain,
  finalUrl,
  ...props
}: React.ComponentProps<typeof Alert> & {
  domain: string;
  finalUrl?: string | null;
}) {
  try {
    if (!finalUrl) return null;
    const dest = new URL(finalUrl).hostname
      .replace(/^www\./i, "")
      .toLowerCase();
    const src = domain.replace(/^www\./i, "").toLowerCase();
    if (dest === src) return null;
    return (
      <Alert {...props}>
        <Milestone aria-hidden="true" />
        <AlertDescription>
          <p className="text-[13px]">
            We followed a redirect to{" "}
            <a
              href={`/${encodeURIComponent(dest)}`}
              className="mx-px font-medium text-foreground/90 underline underline-offset-3"
            >
              {dest}
            </a>
            .
          </p>
        </AlertDescription>
      </Alert>
    );
  } catch {
    return null;
  }
}
