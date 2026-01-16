"use client";

import {
  ArrowCounterClockwiseIcon,
  WarningIcon,
} from "@phosphor-icons/react/ssr";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { CreateIssueButton } from "@/components/create-issue-button";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { analytics } from "@/lib/analytics/client";

interface Props {
  children: React.ReactNode;
  /** Display name for the report section (e.g., "Registration", "DNS") */
  sectionName: string;
}

function SectionErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const isDev = process.env.NODE_ENV === "development";
  const errorObj = error instanceof Error ? error : undefined;

  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <WarningIcon />
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
          <Button variant="outline" size="sm" onClick={resetErrorBoundary}>
            <ArrowCounterClockwiseIcon />
            Try again
          </Button>
          <CreateIssueButton error={errorObj} variant="ghost" size="sm" />
        </div>
      </EmptyContent>
    </Empty>
  );
}

/**
 * Error boundary for individual domain sections.
 * Catches rendering errors and provides a fallback UI without crashing the entire page.
 * Integrates with React Query to reset cached errors on retry.
 */
export function SectionErrorBoundary({ children, sectionName }: Props) {
  const { reset } = useQueryErrorResetBoundary();

  return (
    <ErrorBoundary
      FallbackComponent={SectionErrorFallback}
      onReset={reset}
      onError={(error, errorInfo) => {
        if (error instanceof Error) {
          analytics.trackException(error, {
            section: sectionName,
            componentStack: errorInfo.componentStack,
          });
        }
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
