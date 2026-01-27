"use client";

import { Alert, AlertDescription, AlertTitle } from "@domainstack/ui/alert";
import { IconAlertTriangle } from "@tabler/icons-react";
import { ReportSection } from "@/components/domain/report-section";
import type { SectionDef } from "@/lib/constants/sections";

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
          <p>
            {error ??
              "This section couldn't be loaded. Please try refreshing the page."}
          </p>
        </AlertDescription>
      </Alert>
    </ReportSection>
  );
}
