"use client";

import { ChevronDown, Settings } from "lucide-react";
import { useEffect, useRef } from "react";
import { SettingsContent } from "@/components/settings/settings-content";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useScrollIndicators } from "@/hooks/use-scroll-indicators";
import { cn } from "@/lib/utils";

interface SettingsDialogProps {
  className?: string;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

function ScrollableSettingsContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const { showStart, showEnd, update } = useScrollIndicators({
    containerRef: scrollRef,
    direction: "vertical",
  });

  // Also observe the content wrapper - this catches when children expand/collapse
  useEffect(() => {
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(contentElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [update]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Top scroll shadow */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-black/15 to-transparent transition-opacity duration-200 dark:from-black/40",
          showStart ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      />

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className={cn("min-h-0 flex-1 overflow-y-auto", className)}
      >
        {/* Inner wrapper to observe content height changes (e.g., collapsibles) */}
        <div ref={contentRef}>{children}</div>
      </div>

      {/* Bottom scroll indicator with shadow and chevron */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center transition-opacity duration-200",
          showEnd ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      >
        {/* Gradient shadow */}
        <div className="h-12 w-full bg-gradient-to-t from-black/20 to-transparent dark:from-black/50" />
        {/* Chevron indicator */}
        <div className="absolute bottom-1 flex items-center justify-center">
          <ChevronDown className="size-5 animate-bounce text-muted-foreground/70" />
        </div>
      </div>
    </div>
  );
}

export function SettingsDialog({
  className,
  open,
  onOpenChange,
}: SettingsDialogProps) {
  // Controlled mode: open/onOpenChange are provided
  const isControlled = open !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!isControlled && (
        <DialogTrigger
          render={
            <Button
              aria-label="Open settings"
              variant="ghost"
              size="sm"
              className={className}
            >
              <Settings />
              <span className="sr-only">Open settings</span>
            </Button>
          }
        />
      )}

      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden rounded-3xl border-black/10 p-0 dark:border-white/10">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-0 text-left">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your subscription, notifications, and account preferences.
          </DialogDescription>
        </DialogHeader>
        <ScrollableSettingsContent className="max-h-full px-6 pb-6">
          <SettingsContent showCard={false} />
        </ScrollableSettingsContent>
      </DialogContent>
    </Dialog>
  );
}
