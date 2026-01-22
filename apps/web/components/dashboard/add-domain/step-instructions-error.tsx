import {
  ArrowClockwiseIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";

type StepInstructionsErrorProps = {
  error?: string;
  onRetry: () => void;
  isRetrying: boolean;
};

export function StepInstructionsError({
  error,
  onRetry,
  isRetrying,
}: StepInstructionsErrorProps) {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center space-y-4">
      <Icon size="lg" variant="destructive" className="mx-auto">
        <WarningCircleIcon />
      </Icon>
      <div className="text-center" aria-live="polite">
        <h3 className="font-semibold">Unable to load verification details</h3>
        <p className="text-muted-foreground text-sm">
          {error || "Something went wrong. Please try again."}
        </p>
      </div>
      <Button
        variant="outline"
        onClick={onRetry}
        disabled={isRetrying}
        aria-label="Retry"
      >
        {isRetrying ? (
          <>
            <Spinner />
            <span className="hidden sm:inline">Retrying…</span>
          </>
        ) : (
          <>
            <ArrowClockwiseIcon aria-hidden="true" />
            <span className="hidden sm:inline">Retry</span>
          </>
        )}
      </Button>
    </div>
  );
}
