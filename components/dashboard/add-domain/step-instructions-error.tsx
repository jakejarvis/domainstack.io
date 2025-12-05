"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="size-6 text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold">Unable to load instructions</h3>
        <p className="text-muted-foreground text-sm">
          {error || "Something went wrong. Please try again."}
        </p>
      </div>
      <Button variant="outline" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? (
          <Spinner className="size-4" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {isRetrying ? "Retrying..." : "Retry"}
      </Button>
    </div>
  );
}
