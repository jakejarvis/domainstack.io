import { IconShieldExclamation } from "@tabler/icons-react";

import { Alert, AlertDescription, AlertTitle } from "@domainstack/ui/alert";
import { cn } from "@domainstack/ui/utils";
import { describeTlsValidationError } from "@domainstack/utils/tls";

export function CertificateAlert({
  validationError,
  className,
  title,
  ...props
}: React.ComponentProps<typeof Alert> & {
  validationError?: string | null;
  title?: string;
}) {
  const copy = describeTlsValidationError(validationError);
  const description = copy.description;
  const resolvedTitle = title ?? copy.title;

  return (
    <Alert variant="destructive" className={cn(className)} {...props}>
      <IconShieldExclamation aria-hidden className="size-4" />
      <AlertTitle>{resolvedTitle}</AlertTitle>
      <AlertDescription>
        <p>{description}</p>
        {validationError ? (
          <p className="font-mono text-[11px] text-muted-foreground">{validationError}</p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
