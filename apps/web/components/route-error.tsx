"use client";

import { IconRefresh } from "@tabler/icons-react";
import posthogClient from "posthog-js";
import { useEffect } from "react";

import { CreateIssueButton } from "@/components/create-issue-button";
import { Button } from "@domainstack/ui/button";
import { CodeBlock } from "@domainstack/ui/code-block";

type RouteErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
  title?: string;
  description?: string;
};

/** Shared UI for `error.tsx` route segment boundaries. */
export function RouteError({
  error,
  retry,
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
}: RouteErrorProps) {
  useEffect(() => {
    posthogClient.captureException(error, { digest: error.digest });
  }, [error]);

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">{isDev ? error.message : description}</p>
        {isDev && error?.stack ? (
          <div className="mt-4 text-left">
            <CodeBlock className="max-h-64 text-xs leading-relaxed">{error.stack}</CodeBlock>
          </div>
        ) : null}
        {error?.digest ? (
          <p className="mt-2 text-xs text-muted-foreground">Error id: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-col items-center justify-center gap-3">
          <Button size="sm" onClick={() => retry()}>
            <IconRefresh />
            Retry
          </Button>
          <CreateIssueButton error={error} variant="outline" size="sm" />
        </div>
      </div>
    </div>
  );
}
