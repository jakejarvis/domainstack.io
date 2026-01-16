"use client";

import {
  ArrowCounterClockwiseIcon,
  WarningIcon,
} from "@phosphor-icons/react/ssr";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { CreateIssueButton } from "@/components/create-issue-button";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { analytics } from "@/lib/analytics/client";

interface Props {
  children: React.ReactNode;
  /** Display name for the settings section (e.g., "Account", "Notifications") */
  sectionName: string;
}

/**
 * Compact error fallback for settings panels.
 * Shows inline error with retry button - matches settings UI style.
 */
function SettingsErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <CardHeader className="px-0 pt-0 pb-2">
      <CardTitle className="mb-1 flex items-center gap-2 text-destructive leading-none">
        <WarningIcon className="size-4.5" />
        Failed to load
      </CardTitle>
      <CardDescription>
        {isDev && error ? error.message : "Something went wrong."}
      </CardDescription>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={resetErrorBoundary}>
          <ArrowCounterClockwiseIcon />
          Try again
        </Button>
        <CreateIssueButton error={error} variant="ghost" size="sm" />
      </div>
    </CardHeader>
  );
}

/**
 * Error boundary for settings panels.
 * Provides a compact inline error state that matches settings UI.
 * Integrates with React Query to reset cached errors on retry.
 */
export function SettingsErrorBoundary({ children, sectionName }: Props) {
  const { reset } = useQueryErrorResetBoundary();

  return (
    <ErrorBoundary
      FallbackComponent={SettingsErrorFallback}
      onReset={reset}
      onError={(error, errorInfo) => {
        analytics.trackException(error, {
          section: sectionName,
          context: "settings",
          componentStack: errorInfo.componentStack,
        });
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
