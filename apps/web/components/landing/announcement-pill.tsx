"use client";

import {
  ArrowUpRightIcon,
  ShootingStarIcon,
  XIcon,
} from "@phosphor-icons/react/ssr";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import useLocalStorageState from "use-local-storage-state";

const STORAGE_KEY = "announcement-dismissed-accounts-launch";

export function AnnouncementPill() {
  const shouldReduceMotion = useReducedMotion();
  const [dismissed, setDismissed] = useLocalStorageState(STORAGE_KEY, {
    defaultValue: false,
  });

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
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
          <div className="relative inline-flex items-center rounded-full border border-black/10 bg-gradient-to-r from-black/[0.02] to-black/[0.04] text-sm backdrop-blur-sm transition-all hover:border-black/20 hover:from-black/[0.04] hover:to-black/[0.06] dark:border-white/10 dark:from-white/[0.02] dark:to-white/[0.04] dark:hover:border-white/20 dark:hover:from-white/[0.04] dark:hover:to-white/[0.06]">
            {/* Shimmer effect */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
              <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            </div>

            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 py-1.5 pr-2 pl-3"
            >
              <ShootingStarIcon className="size-3.5 text-accent-gold" />
              <div className="text-foreground/90">
                <span className="mr-1.5 font-medium text-accent-gold">
                  New!
                </span>
                <span>Track domains &amp; get health alerts.</span>
              </div>
              <ArrowUpRightIcon className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-[1px] group-hover:-translate-y-[1px]" />
            </Link>

            <div className="h-4 w-px bg-black/10 dark:bg-white/10" />

            <button
              type="button"
              onClick={handleDismiss}
              className="cursor-pointer rounded-full p-1.5 pr-2.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
              aria-label="Dismiss announcement"
            >
              <XIcon className="size-3.5" weight="bold" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
