"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useScrollIndicators } from "@/hooks/use-scroll-indicators";
import { cn } from "@/lib/utils";

interface ModalProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  showHeader?: boolean;
}

function ScrollableContent({
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

export function Modal({
  children,
  className,
  title = "Modal",
  description = "Modal content",
  showHeader = false,
}: ModalProps) {
  const router = useRouter();

  return (
    <Dialog defaultOpen open onOpenChange={() => router.back()}>
      <DialogContent
        className={cn(
          "flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0",
          className,
        )}
      >
        <DialogHeader
          className={cn(
            showHeader ? "border-muted border-b px-6 pt-6 pb-4" : "sr-only",
          )}
        >
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ScrollableContent className="py-6">{children}</ScrollableContent>
      </DialogContent>
    </Dialog>
  );
}
