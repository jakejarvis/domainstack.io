"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { useEffect } from "react";
import { CreateIssueButton } from "@/components/create-issue-button";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/analytics/client";

export default function RootError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { error, reset } = props;

  useEffect(() => {
    analytics.trackException(error, { digest: error.digest });
  }, [error]);

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="text-center">
        <h1 className="font-semibold text-2xl tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-2 text-muted-foreground">
          {isDev
            ? error.message
            : "An unexpected error occurred. Please try again."}
        </p>
        {isDev && error?.stack ? (
          <pre className="mt-4 max-h-64 overflow-auto rounded-md bg-muted p-4 text-left text-xs leading-relaxed">
            {error.stack}
          </pre>
        ) : null}
        {error?.digest ? (
          <p className="mt-2 text-muted-foreground text-xs">
            Error id: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col items-center justify-center gap-3">
          <Button size="sm" onClick={() => reset()}>
            <ArrowClockwiseIcon />
            Retry
          </Button>
          <CreateIssueButton error={error} variant="outline" size="sm" />
        </div>
      </div>
    </div>
  );
}
