import { Alert, AlertDescription, AlertTitle } from "@domainstack/ui/alert";
import { cn } from "@domainstack/ui/utils";
import { IconShieldExclamation } from "@tabler/icons-react";

export function CertificateAlert({
  error,
  className,
  title = "Invalid SSL certificate",
  ...props
}: React.ComponentProps<typeof Alert> & {
  error?: string;
  title?: string;
}) {
  return (
    <Alert variant="destructive" className={cn(className)} {...props}>
      <IconShieldExclamation aria-hidden className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {error ||
          "The security certificate for this site is invalid or expired."}
      </AlertDescription>
    </Alert>
  );
}
