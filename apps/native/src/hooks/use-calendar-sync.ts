import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { analytics } from "@/lib/analytics";
import { useTRPC } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { hasCalendarPermission, reconcile, teardown } from "@/lib/calendar-sync";
import { useCalendarSyncStore } from "@/lib/stores/calendar-sync-store";

// Foreground/mount runs are throttled like push refresh; a portfolio change
// (add/remove/archive/mute/renew) bypasses the throttle but is debounced so a
// burst of optimistic cache writes collapses into a single reconcile.
const RECONCILE_THROTTLE_MS = 15 * 60 * 1000;
const PORTFOLIO_DEBOUNCE_MS = 3_000;

/**
 * Managed background sync of the device "Domainstack" calendar.
 *
 * Best-effort and non-blocking by design — modeled on
 * {@link useForegroundPushRefresh}: it never throws into render, never toasts
 * on background runs, and silently no-ops when sync is disabled or calendar
 * permission isn't granted. Mounted once from the root navigator.
 */
export function useCalendarSync() {
  const session = authClient.useSession();
  const isSignedIn = Boolean(session.data?.user);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const enabled = useCalendarSyncStore((s) => s.enabled);
  const hasHydrated = useCalendarSyncStore((s) => s.hasHydrated);

  const lastRunRef = useRef(0);

  // tRPC + query client objects aren't guaranteed referentially stable; stash
  // the reconcile routine in a ref so the effects below only re-subscribe when
  // sign-in / enabled / hydration state actually changes.
  const reconcileRef = useRef<(opts: { throttled: boolean }) => Promise<void>>(async () => {});
  reconcileRef.current = async ({ throttled }) => {
    if (!useCalendarSyncStore.getState().enabled) return;

    const now = Date.now();
    if (throttled && now - lastRunRef.current < RECONCILE_THROTTLE_MS) return;

    try {
      if (!(await hasCalendarPermission())) return;
      lastRunRef.current = now;
      const domains = await queryClient.ensureQueryData(
        trpc.tracking.listDomains.queryOptions({ includeArchived: false }),
      );
      await reconcile(domains);
    } catch (error) {
      // Best-effort: a failed sync must never block app usage. No toast —
      // this runs in the background; surface only to error tracking.
      analytics.trackException(error, { context: "calendar-sync" });
    }
  };

  // Tear the calendar down when the user signs out (or switches accounts).
  // Events are device-local, so a stale calendar would leak the previous
  // user's domains on a shared device.
  const wasSignedInRef = useRef(isSignedIn);
  useEffect(() => {
    const wasSignedIn = wasSignedInRef.current;
    wasSignedInRef.current = isSignedIn;
    if (wasSignedIn && !isSignedIn) {
      lastRunRef.current = 0;
      void teardown().catch((error) => {
        analytics.trackException(error, { context: "calendar-sync-teardown" });
      });
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!enabled || !isSignedIn || !hasHydrated) return;

    void reconcileRef.current({ throttled: true });

    const appStateSub = AppState.addEventListener("change", (next) => {
      if (next === "active") void reconcileRef.current({ throttled: true });
    });

    // Re-sync shortly after the portfolio changes in-app (the optimistic
    // cache writes in `use-dashboard-mutations` land here). Debounced to
    // coalesce bursts; bypasses the throttle since it's an explicit signal.
    const listKey = JSON.stringify(trpc.tracking.listDomains.queryKey()[0]);
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = queryClient.getQueryCache().subscribe((cacheEvent) => {
      if (cacheEvent.type !== "updated") return;
      const key = cacheEvent.query.queryKey;
      if (!Array.isArray(key) || JSON.stringify(key[0]) !== listKey) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        void reconcileRef.current({ throttled: false });
      }, PORTFOLIO_DEBOUNCE_MS);
    });

    return () => {
      appStateSub.remove();
      if (debounce) clearTimeout(debounce);
      unsubscribe();
    };
  }, [enabled, isSignedIn, hasHydrated, queryClient, trpc]);
}
