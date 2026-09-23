"use client";

import { IconArrowUpRight, IconMeteor, IconX } from "@tabler/icons-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";

import { useAnnouncement } from "@/lib/stores/ui-store";

export function AnnouncementPill() {
  const shouldReduceMotion = useReducedMotion();
  const { visible, dismiss } = useAnnouncement();

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dismiss();
  };

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          initial={{
            opacity: 0,
            y: shouldReduceMotion ? 0 : -10,
            scale: shouldReduceMotion ? 1 : 0.95,
          }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{
            opacity: 0,
            scale: shouldReduceMotion ? 1 : 0.95,
          }}
          transition={{
            duration: shouldReduceMotion ? 0.15 : 0.3,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="absolute right-0 bottom-full left-0 z-10 mb-8 flex items-center justify-center"
        >
          <div className="relative inline-flex items-center rounded-full border bg-muted/40 text-sm transition-colors hover:border-foreground/20 hover:bg-muted/80">
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 py-1.5 pr-2 pl-3"
            >
              <IconMeteor className="size-3.5 text-accent-gold" />
              <div className="text-foreground/90">
                <span className="mr-1.5 font-medium text-accent-gold">New!</span>
                <span>Track domains &amp; get health alerts.</span>
              </div>
              <IconArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-[1px] group-hover:-translate-y-[1px]" />
            </Link>

            <div className="h-4 w-px bg-black/10 dark:bg-white/10" />

            <button
              type="button"
              onClick={handleDismiss}
              className="cursor-pointer rounded-full p-1.5 pr-2.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
              aria-label="Dismiss announcement"
            >
              <IconX className="size-3.5" />
            </button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
