"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CertificateBypassedAlert({
  domain,
  ...props
}: React.ComponentProps<typeof Alert> & {
  domain: string;
}) {
  return (
    <Alert
      {...props}
      className="border-black/10 bg-background/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur supports-[backdrop-filter]:bg-background/40 dark:border-white/10"
    >
      <ShieldAlert aria-hidden="true" />
      <AlertDescription>
        <p className="text-[13px]">
          This site&apos;s SSL/TLS certificate is invalid or expired. We
          bypassed certificate validation to fetch headers. Browsers will show
          security warnings to visitors. See{" "}
          <Link
            href={`/${encodeURIComponent(domain)}#certificates`}
            className="inline-flex items-center gap-1 text-foreground/90 underline underline-offset-3 hover:text-muted-foreground"
            title="View certificate details"
          >
            <span className="font-medium">Certificates section</span>
          </Link>{" "}
          for details.
        </p>
      </AlertDescription>
    </Alert>
  );
}
