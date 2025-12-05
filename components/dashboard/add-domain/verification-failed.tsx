"use client";

import { AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { VerificationMethod } from "@/lib/schemas";

type VerificationFailedProps = {
  method: VerificationMethod;
  error?: string;
  isVerifying: boolean;
  onCheckAgain: () => void;
  onReturnLater: () => void;
};

const TROUBLESHOOTING_TIPS: Record<
  VerificationMethod,
  { title: string; tips: string[] }
> = {
  dns_txt: {
    title: "DNS Record Troubleshooting",
    tips: [
      "DNS changes can take up to 24-48 hours to propagate globally.",
      "Verify the TXT record exists in your DNS provider's dashboard.",
      "Ensure the hostname matches exactly (including the underscore prefix).",
      "Check that the value is copied correctly without extra spaces.",
      "Some DNS providers require removing the domain suffix from the hostname.",
    ],
  },
  html_file: {
    title: "HTML File Troubleshooting",
    tips: [
      "Ensure the file is accessible at the exact path shown.",
      "The file should contain only the verification token, with no extra content.",
      "Check that your server isn't redirecting the request (e.g., to HTTPS or www).",
      "Verify there are no permission issues blocking access to the file.",
      "Some hosting providers may cache files—try clearing your CDN cache.",
    ],
  },
  meta_tag: {
    title: "Meta Tag Troubleshooting",
    tips: [
      "Ensure the meta tag is placed inside the <head> section of your homepage.",
      "The page must be publicly accessible (not behind authentication).",
      "Check that there are no typos in the meta tag name or content.",
      "If using a framework, ensure the meta tag renders on the server (SSR).",
      "Clear any page caches and verify the tag appears in the page source.",
    ],
  },
};

export function VerificationFailed({
  method,
  error,
  isVerifying,
  onCheckAgain,
  onReturnLater,
}: VerificationFailedProps) {
  const troubleshooting = TROUBLESHOOTING_TIPS[method];

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>Verification Failed</AlertTitle>
        <AlertDescription>
          {error ||
            "We couldn't verify your domain ownership. Please check your setup and try again."}
        </AlertDescription>
      </Alert>

      <div className="rounded-lg bg-muted p-4">
        <h4 className="mb-2 font-medium text-sm">{troubleshooting.title}</h4>
        <ul className="space-y-1.5 text-muted-foreground text-sm">
          {troubleshooting.tips.map((tip) => (
            <li key={tip} className="flex gap-2">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={onCheckAgain}
          disabled={isVerifying}
          className="flex-1"
        >
          {isVerifying ? (
            <Spinner className="size-4" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {isVerifying ? "Checking..." : "Check Again"}
        </Button>
        <Button
          variant="outline"
          onClick={onReturnLater}
          disabled={isVerifying}
          className="flex-1"
        >
          <Clock className="size-4" />
          Return Later
        </Button>
      </div>

      <p className="text-center text-muted-foreground text-xs">
        Don&apos;t worry—we&apos;ll automatically check your domain daily and
        verify it once the changes have propagated.
      </p>
    </div>
  );
}
