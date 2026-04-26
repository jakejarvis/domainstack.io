import { IconAlertCircle, IconRefresh } from "@tabler/icons-react";

import { Button } from "@domainstack/ui/button";
import { Icon } from "@domainstack/ui/icon";
import { Spinner } from "@domainstack/ui/spinner";

type StepInstructionsErrorProps = {
  error?: string;
  onRetry: () => void;
  isRetrying: boolean;
};

export function StepInstructionsError({ error, onRetry, isRetrying }: StepInstructionsErrorProps) {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center space-y-4">
      <Icon size="lg" variant="destructive" className="mx-auto">
        <IconAlertCircle />
      </Icon>
      <div className="text-center" aria-live="polite">
        <h3 className="font-semibold">Unable to load verification details</h3>
        <p className="text-sm text-muted-foreground">
          {error || "Something went wrong. Please try again."}
        </p>
      </div>
      <Button variant="outline" onClick={onRetry} disabled={isRetrying} aria-label="Retry">
        {isRetrying ? (
          <>
            <Spinner />
            <span className="hidden sm:inline">Retrying…</span>
          </>
        ) : (
          <>
            <IconRefresh aria-hidden="true" />
            <span className="hidden sm:inline">Retry</span>
          </>
        )}
      </Button>
    </div>
  );
}
