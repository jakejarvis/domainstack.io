"use client";

import { ArrowUpRight, BellRing, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import useLocalStorageState from "use-local-storage-state";
import { LoginDialog } from "@/components/auth/login-dialog";
import { useSession } from "@/lib/auth-client";

const STORAGE_KEY = "announcement-dismissed-accounts-launch";

export function AnnouncementPill() {
  const { data: session } = useSession();
  const [dismissed, setDismissed] = useLocalStorageState(STORAGE_KEY, {
    defaultValue: false,
  });
  const [loginOpen, setLoginOpen] = useState(false);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissed(true);
  };

  // For logged-out users, open login modal on click (but allow ctrl+click to /login)
  const handleLinkClick = (e: React.MouseEvent) => {
    if (session?.user) return; // Logged in - let link work normally
    // Allow ctrl+click, cmd+click, middle-click, shift+click to open in new tab
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    setLoginOpen(true);
  };

  // Link to dashboard if logged in, otherwise to login (fallback for ctrl+click)
  const href = session?.user ? "/dashboard" : "/login";

  return (
    <>
      <AnimatePresence>
        {!dismissed && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-0 right-0 left-0 flex items-center justify-center"
          >
            <div className="relative inline-flex items-center rounded-full border border-black/10 bg-gradient-to-r from-black/[0.02] to-black/[0.04] text-sm backdrop-blur-sm transition-all hover:border-black/20 hover:from-black/[0.04] hover:to-black/[0.06] dark:border-white/10 dark:from-white/[0.02] dark:to-white/[0.04] dark:hover:border-white/20 dark:hover:from-white/[0.04] dark:hover:to-white/[0.06]">
              {/* Shimmer effect */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                <div className="absolute inset-0 animate-[shimmer_6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              </div>

              <Link
                href={href}
                onClick={handleLinkClick}
                // Disable progress bar when opening modal (logged out), allow for navigation (logged in)
                data-disable-progress={!session?.user}
                className="group inline-flex items-center gap-2 py-1.5 pr-2 pl-3"
              >
                <BellRing className="size-3.5 text-accent-gold" />
                <div className="text-foreground/90">
                  <span className="mr-1.5 font-medium text-accent-gold">
                    New!
                  </span>
                  <span>Track domains &amp; get expiry alerts.</span>
                </div>
                <ArrowUpRight className="group-hover:-translate-y-[1px] size-3.5 text-muted-foreground transition-transform group-hover:translate-x-[1px]" />
              </Link>

              <div className="h-4 w-px bg-black/10 dark:bg-white/10" />

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

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}
