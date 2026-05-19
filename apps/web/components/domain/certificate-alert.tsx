"use client";

import { useLingui } from "@lingui/react/macro";
import { IconShieldExclamation } from "@tabler/icons-react";

import { Alert, AlertDescription, AlertTitle } from "@domainstack/ui/alert";
import { cn } from "@domainstack/ui/utils";

export function CertificateAlert({
  error,
  className,
  title,
  ...props
}: React.ComponentProps<typeof Alert> & {
  error?: string;
  title?: string;
}) {
  const { t } = useLingui();
  return (
    <Alert variant="destructive" className={cn(className)} {...props}>
      <IconShieldExclamation aria-hidden className="size-4" />
      <AlertTitle>{title ?? t`Invalid SSL certificate`}</AlertTitle>
      <AlertDescription>
        {error || t`The security certificate for this site is invalid or expired.`}
      </AlertDescription>
    </Alert>
  );
}
