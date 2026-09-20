"use client";

import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { catchError, type ErrorInfo } from "next/error";
import { useEffect } from "react";

import { CreateIssueButton } from "@/components/create-issue-button";
import { analytics } from "@/lib/analytics/client";
import { Button } from "@domainstack/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@domainstack/ui/empty";

interface Props {
  /** Display name for the report section (e.g., "Registration", "DNS") */
  sectionName: string;
}

function SectionErrorFallback({ sectionName, error, retry }: Props & ErrorInfo) {
  const { reset: resetQueryErrors } = useQueryErrorResetBoundary();
  const isDev = process.env.NODE_ENV === "development";
  const errorObj = error instanceof Error ? error : undefined;

  useEffect(() => {
    if (errorObj) analytics.trackException(errorObj, { section: sectionName });
  }, [errorObj, sectionName]);

  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconAlertTriangle />
        </EmptyMedia>
        <EmptyTitle>Something went wrong</EmptyTitle>
        <EmptyDescription>
          {isDev && errorObj
            ? errorObj.message
            : "This section encountered an error and couldn't be displayed."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetQueryErrors();
              retry();
            }}
          >
            <IconRefresh />
            Retry
          </Button>
          <CreateIssueButton error={errorObj} variant="outline" size="sm" />
        </div>
      </EmptyContent>
    </Empty>
  );
}

/**
 * Error boundary for individual domain sections.
 * Catches rendering errors and provides a fallback UI without crashing the entire page.
 * Resets React Query's cached errors on retry.
 */
export const SectionErrorBoundary = catchError((props: Props, errorInfo: ErrorInfo) => (
  <SectionErrorFallback {...props} {...errorInfo} />
));
