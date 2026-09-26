"use client";

import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { catchError, type ErrorInfo } from "next/error";
import posthogClient from "posthog-js";
import { useEffect } from "react";

import { CreateIssueButton } from "@/components/create-issue-button";
import { Button } from "@domainstack/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@domainstack/ui/card";

interface Props {
  /** Display name for the settings section (e.g., "Account", "Notifications") */
  sectionName: string;
}

/**
 * Compact error fallback for settings panels.
 * Shows inline error with retry button - matches settings UI style.
 */
function SettingsErrorFallback({ sectionName, error, retry }: Props & ErrorInfo) {
  const { reset: resetQueryErrors } = useQueryErrorResetBoundary();
  const isDev = process.env.NODE_ENV === "development";
  const errorObj = error instanceof Error ? error : undefined;

  useEffect(() => {
    if (errorObj)
      posthogClient.captureException(errorObj, { section: sectionName, context: "settings" });
  }, [errorObj, sectionName]);

  return (
    <CardHeader className="px-0 pt-0 pb-2">
      <CardTitle className="mb-1 flex items-center gap-2 leading-none text-destructive">
        <IconAlertTriangle className="size-4.5" />
        Failed to load
      </CardTitle>
      <CardDescription>
        {isDev && errorObj ? errorObj.message : "Something went wrong."}
      </CardDescription>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
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
    </CardHeader>
  );
}

/**
 * Error boundary for settings panels.
 * Provides a compact inline error state that matches settings UI.
 * Resets React Query's cached errors on retry.
 */
export const SettingsErrorBoundary = catchError((props: Props, errorInfo: ErrorInfo) => (
  <SettingsErrorFallback {...props} {...errorInfo} />
));
