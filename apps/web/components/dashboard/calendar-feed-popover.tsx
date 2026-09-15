"use client";

import { IconAlertTriangle, IconCalendarClock, IconRefresh, IconX } from "@tabler/icons-react";
import { useQueryClient, useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Suspense, useRef, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

import { CalendarInstructions } from "@/components/calendar-instructions";
import { CreateIssueButton } from "@/components/create-issue-button";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@domainstack/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from "@domainstack/ui/popover";
import { Spinner } from "@domainstack/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@domainstack/ui/tooltip";

/**
 * Compact error fallback for popover content.
 */
function PopoverErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const errorObj = error instanceof Error ? error : undefined;

  return (
    <div className="flex flex-col items-center gap-2 p-4 text-center">
      <IconAlertTriangle className="size-5 text-destructive" />
      <p className="text-sm text-muted-foreground">Failed to load</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" onClick={resetErrorBoundary}>
          <IconRefresh />
          Retry
        </Button>
        <CreateIssueButton error={errorObj} variant="outline" size="sm" />
      </div>
    </div>
  );
}

export function CalendarFeedPopover() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { reset } = useQueryErrorResetBoundary();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleTriggerClick = async () => {
    if (open) {
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      await queryClient.query({
        ...trpc.user.getCalendarFeed.queryOptions(),
        staleTime: "static",
      });
    } catch {
      // Errors surface once the popover opens, via the ErrorBoundary below.
    } finally {
      setLoading(false);
      setOpen(true);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              ref={triggerRef}
              variant="outline"
              size="icon"
              onClick={handleTriggerClick}
              disabled={loading}
            >
              {loading ? <Spinner /> : <IconCalendarClock />}
              <span className="sr-only">Subscribe</span>
            </Button>
          }
        />
        <TooltipContent>Subscribe to updates</TooltipContent>
      </Tooltip>
      <PopoverContent
        anchor={triggerRef}
        className="overflow-hidden bg-background p-0 max-sm:!right-0 max-sm:!left-0 max-sm:!mx-auto max-sm:w-[calc(100vw-1rem)] max-sm:!translate-x-0 sm:w-[400px]"
        align="end"
        side="bottom"
        collisionAvoidance={{
          side: "none",
          align: "shift",
        }}
        collisionPadding={8}
      >
        <PopoverHeader className="border-b border-border bg-card/60 px-4 pt-3 pb-2.5">
          <PopoverTitle>Calendar Feed</PopoverTitle>
          <PopoverDescription className="text-[13px] leading-normal">
            Subscribe to domain expiration dates in your favorite calendar app
          </PopoverDescription>

          <Button
            variant="ghost"
            className="absolute top-2 right-2 z-10 size-6 text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <IconX />
            <span className="sr-only">Close</span>
          </Button>
        </PopoverHeader>

        <ErrorBoundary FallbackComponent={PopoverErrorFallback} onReset={reset}>
          <Suspense fallback={null}>
            <CalendarInstructions className="bg-popover/10 p-4" />
          </Suspense>
        </ErrorBoundary>
      </PopoverContent>
    </Popover>
  );
}
