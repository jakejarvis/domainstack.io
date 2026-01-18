import { ShieldWarningIcon } from "@phosphor-icons/react/ssr";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

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
      <ShieldWarningIcon aria-hidden className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {error ||
          "The security certificate for this site is invalid or expired."}
      </AlertDescription>
    </Alert>
  );
}
