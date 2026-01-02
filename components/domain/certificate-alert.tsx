import { ShieldAlert } from "lucide-react";
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
      <ShieldAlert aria-hidden className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {error ||
          "The security certificate for this site is invalid or expired."}
      </AlertDescription>
    </Alert>
  );
}
