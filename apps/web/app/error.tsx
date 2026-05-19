"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { IconRefresh } from "@tabler/icons-react";
import { useEffect } from "react";

import { CreateIssueButton } from "@/components/create-issue-button";
import { analytics } from "@domainstack/analytics/client";
import { Button } from "@domainstack/ui/button";

export default function RootError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { error, reset } = props;
  const { t } = useLingui();

  useEffect(() => {
    analytics.trackException(error, { digest: error.digest });
  }, [error]);

  const isDev = process.env.NODE_ENV !== "production";
  const digest = error?.digest;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          <Trans>Something went wrong</Trans>
        </h1>
        <p className="mt-2 text-muted-foreground">
          {isDev ? error.message : t`An unexpected error occurred. Please try again.`}
        </p>
        {isDev && error?.stack ? (
          <pre className="mt-4 max-h-64 overflow-auto rounded-md bg-muted p-4 text-left text-xs leading-relaxed">
            {error.stack}
          </pre>
        ) : null}
        {digest ? (
          <p className="mt-2 text-xs text-muted-foreground">
            <Trans>Error id: {digest}</Trans>
          </p>
        ) : null}
        <div className="mt-6 flex flex-col items-center justify-center gap-3">
          <Button size="sm" onClick={() => reset()}>
            <IconRefresh />
            <Trans>Retry</Trans>
          </Button>
          <CreateIssueButton error={error} variant="outline" size="sm" />
        </div>
      </div>
    </div>
  );
}
