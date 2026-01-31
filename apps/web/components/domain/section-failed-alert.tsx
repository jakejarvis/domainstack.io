"use client";

import { Alert, AlertDescription, AlertTitle } from "@domainstack/ui/alert";
import { IconAlertTriangle } from "@tabler/icons-react";
import { ReportSection } from "@/components/domain/report-section";
import type { SectionDef } from "@/lib/constants/sections";

/**
 * Map error codes to user-friendly messages.
 */
const errorMessages: Record<string, string> = {
  dns_error:
    "The domain could not be resolved. It may not exist or DNS is misconfigured.",
  tls_error: "The SSL certificate is invalid or could not be verified.",
  fetch_failed: "Failed to fetch data. Please try again later.",
};

function getErrorMessage(error?: string): string {
  if (!error) {
    return "This section couldn't be loaded. Please try refreshing the page.";
  }
  return errorMessages[error] ?? error;
}

interface SectionFailedAlertProps {
  section: SectionDef;
  error?: string;
}

/**
 * Alert shown when a workflow fails to load data for a report section.
 * Wraps the alert in a ReportSection to maintain consistent layout.
 */
export function SectionFailedAlert({
  section,
  error,
}: SectionFailedAlertProps) {
  return (
    <ReportSection {...section}>
      <Alert variant="destructive">
        <IconAlertTriangle className="size-4" />
        <AlertTitle>Failed to load data</AlertTitle>
        <AlertDescription>
          <p>{getErrorMessage(error)}</p>
        </AlertDescription>
      </Alert>
    </ReportSection>
  );
}
