"use client";

import { IconArrowUpRight, IconMeteor, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";

import { useAnnouncement } from "@/lib/stores/ui-store";
import { Button } from "@domainstack/ui/button";
import { Separator } from "@domainstack/ui/separator";
import { cn } from "@domainstack/ui/utils";

export function AnnouncementPill() {
  const { visible, dismiss } = useAnnouncement();
  const [isExiting, setIsExiting] = useState(false);

  // Persist the dismissal right away (so leaving mid-animation still counts), and
  // keep rendering locally until the exit animation finishes.
  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dismiss();
    setIsExiting(true);
  };

  const finishExit = (e: React.AnimationEvent) => {
    if (e.target === e.currentTarget) setIsExiting(false);
  };

  if (!visible && !isExiting) return null;

  return (
    <div
      className={cn(
        "absolute right-0 bottom-full left-0 z-10 mb-8 flex items-center justify-center ease-[cubic-bezier(0.22,1,0.36,1)]",
        isExiting
          ? "animate-out duration-300 fade-out-0 fill-mode-forwards zoom-out-95 motion-reduce:duration-150 motion-reduce:zoom-out-100"
          : "slide-in-from-top-2.5 animate-in duration-300 fade-in-0 zoom-in-95 motion-reduce:duration-150 motion-reduce:slide-in-from-top-0 motion-reduce:zoom-in-100",
      )}
      onAnimationEnd={isExiting ? finishExit : undefined}
    >
      <div className="relative inline-flex items-center rounded-full border bg-muted/40 text-sm transition-colors hover:border-foreground/20 hover:bg-muted/80">
        <Link href="/dashboard" className="group inline-flex items-center gap-2 py-1.5 pr-2 pl-3">
          <IconMeteor className="size-3.5 text-accent-gold" />
          <div className="text-foreground/90">
            <span className="mr-1.5 font-medium text-accent-gold">New!</span>
            <span>Track domains &amp; get health alerts.</span>
          </div>
          <IconArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-[1px] group-hover:-translate-y-[1px]" />
        </Link>

        <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleDismiss}
          className="mx-1 rounded-full text-muted-foreground/50 hover:text-muted-foreground"
          aria-label="Dismiss announcement"
        >
          <IconX className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
