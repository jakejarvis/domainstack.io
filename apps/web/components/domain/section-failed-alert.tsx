"use client";

import { type I18n, type MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { IconAlertTriangle } from "@tabler/icons-react";

import { ReportSection } from "@/components/domain/report-section";
import type { SectionDef } from "@/lib/constants/sections";
import { Alert, AlertDescription, AlertTitle } from "@domainstack/ui/alert";

/**
 * Map error codes to user-friendly messages.
 */
const errorMessages: Record<string, MessageDescriptor> = {
  dns_error: msg`The domain could not be resolved. It may not exist or DNS is misconfigured.`,
  tls_error: msg`The SSL certificate is invalid or could not be verified.`,
  fetch_failed: msg`Failed to fetch data. Please try again later.`,
};

function getErrorMessage(error: string | undefined, i18n: I18n): string {
  if (!error) {
    return i18n._(msg`This section couldn't be loaded. Please try refreshing the page.`);
  }
  const known = errorMessages[error];
  return known ? i18n._(known) : error;
}

interface SectionFailedAlertProps {
  section: SectionDef;
  error?: string;
}

/**
 * Alert shown when a workflow fails to load data for a report section.
 * Wraps the alert in a ReportSection to maintain consistent layout.
 */
export function SectionFailedAlert({ section, error }: SectionFailedAlertProps) {
  const { t, i18n } = useLingui();
  return (
    <ReportSection {...section}>
      <Alert variant="destructive">
        <IconAlertTriangle className="size-4" />
        <AlertTitle>{t`Failed to load data`}</AlertTitle>
        <AlertDescription>
          <p>{getErrorMessage(error, i18n)}</p>
        </AlertDescription>
      </Alert>
    </ReportSection>
  );
}
