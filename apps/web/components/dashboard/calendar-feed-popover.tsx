"use client";

import {
  ArrowClockwiseIcon,
  CalendarIcon,
  RssSimpleIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import {
  CalendarInstructions,
  CalendarInstructionsSkeleton,
} from "@/components/calendar-instructions";
import { CreateIssueButton } from "@/components/create-issue-button";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Compact error fallback for popover content.
 */
function PopoverErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const errorObj = error instanceof Error ? error : undefined;

  return (
    <div className="flex flex-col items-center gap-2 p-4 text-center">
      <WarningIcon className="size-5 text-destructive" />
      <p className="text-muted-foreground text-sm">Failed to load</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" onClick={resetErrorBoundary}>
          <ArrowClockwiseIcon />
          Retry
        </Button>
        <CreateIssueButton error={errorObj} variant="outline" size="sm" />
      </div>
    </div>
  );
}

export function CalendarFeedPopover() {
  const [open, setOpen] = useState(false);
  const { reset } = useQueryErrorResetBoundary();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button variant="outline">
                  <RssSimpleIcon />
                  <span className="sr-only">Subscribe</span>
                </Button>
              }
            />
          }
        />
        <TooltipContent>Subscribe to updates</TooltipContent>
      </Tooltip>
      <PopoverContent
        className="max-sm:!left-0 max-sm:!right-0 max-sm:!mx-auto max-sm:!translate-x-0 overflow-hidden bg-popover/95 p-0 backdrop-blur-lg max-sm:w-[calc(100vw-1rem)] sm:w-[400px]"
        align="end"
        side="bottom"
        collisionAvoidance={{
          side: "none",
          align: "shift",
        }}
        collisionPadding={8}
      >
        <div className="flex flex-col">
          <PopoverHeader className="px-4 pt-5 pb-3">
            <PopoverTitle className="flex items-center gap-2">
              <CalendarIcon className="size-4" />
              Calendar Feed
            </PopoverTitle>
            <PopoverDescription className="mt-0.5">
              Subscribe to domain expiration dates in your favorite calendar
              app.
            </PopoverDescription>

            <Button
              variant="ghost"
              className="absolute top-2 right-2 z-10 size-6 text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </PopoverHeader>

          <Separator className="bg-muted" />

          <ErrorBoundary
            FallbackComponent={PopoverErrorFallback}
            onReset={reset}
          >
            <Suspense
              fallback={
                <CalendarInstructionsSkeleton className="bg-background/50 p-4" />
              }
            >
              <CalendarInstructions className="bg-background/50 p-4" />
            </Suspense>
          </ErrorBoundary>
        </div>
      </PopoverContent>
    </Popover>
  );
}
