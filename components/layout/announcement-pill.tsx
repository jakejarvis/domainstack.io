"use client";

import { ArrowUpRight, BellRing, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import useLocalStorageState from "use-local-storage-state";
import { useSession } from "@/lib/auth-client";

const STORAGE_KEY = "announcement-dismissed-accounts-launch";

export function AnnouncementPill() {
  const { data: session } = useSession();
  const [dismissed, setDismissed] = useLocalStorageState(STORAGE_KEY, {
    defaultValue: false,
  });

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissed(true);
  };

  // Link to dashboard if logged in, otherwise to login
  const href = session?.user ? "/dashboard" : "/login";

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="absolute top-0 right-0 left-0 flex items-center justify-center"
        >
          <div className="relative inline-flex items-center rounded-full border border-accent-purple/20 bg-gradient-to-r from-accent-purple/10 to-accent-blue/10 text-sm backdrop-blur-sm transition-all hover:border-accent-purple/40 hover:from-accent-purple/15 hover:to-accent-blue/15">
            {/* Shimmer effect */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
              <div className="absolute inset-0 animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>

            <Link
              href={href}
              className="group inline-flex items-center gap-2 py-1.5 pr-2 pl-3"
            >
              <BellRing className="size-3.5 text-accent-purple" />
              <div className="text-foreground/90">
                <span className="mr-1.5 font-medium text-accent-purple">
                  New!
                </span>
                <span>Track domains &amp; get expiry alerts.</span>
              </div>
              <ArrowUpRight className="group-hover:-translate-y-[1px] size-3.5 text-muted-foreground transition-transform group-hover:translate-x-[1px]" />
            </Link>

            <div className="h-4 w-px bg-accent-purple/20" />

            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-full p-1.5 pr-2.5 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
              aria-label="Dismiss announcement"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
