"use client";

import { IconAlertTriangle } from "@tabler/icons-react";

import { ReportSection } from "@/components/domain/report-section";
import { getLookupErrorMessage } from "@/lib/constants/lookup-errors";
import type { SectionDef } from "@/lib/constants/sections";
import type { LookupError } from "@domainstack/core/lookup";
import { Alert, AlertDescription, AlertTitle } from "@domainstack/ui/alert";

function getErrorMessage(error?: LookupError): string {
  if (!error) {
    return "This section couldn't be loaded. Please try refreshing the page.";
  }
  return getLookupErrorMessage(error);
}

interface SectionFailedAlertProps {
  section: SectionDef;
  error?: LookupError;
}

/**
 * Alert shown when a workflow fails to load data for a report section.
 * Wraps the alert in a ReportSection to maintain consistent layout.
 */
export function SectionFailedAlert({ section, error }: SectionFailedAlertProps) {
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
