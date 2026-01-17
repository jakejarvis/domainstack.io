"use client";

import type { TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@/server/routers/_app";
import { showRateLimitToast } from "./client";

/**
 * tRPC link that intercepts rate limit errors and shows a toast.
 *
 * Add to the links array before the terminating link:
 * ```ts
 * links: [
 *   rateLimitLink,
 *   httpBatchStreamLink({ ... }),
 * ]
 * ```
 *
 * The error is still passed through, so individual handlers can
 * also react if needed (e.g., for optimistic update rollback).
 */
export const rateLimitLink: TRPCLink<AppRouter> = () => {
  return ({ next, op }) => {
    return observable((observer) => {
      const unsubscribe = next(op).subscribe({
        next(value) {
          observer.next(value);
        },
        error(err) {
          // Show toast for rate limit errors
          showRateLimitToast(err);
          // Still pass the error through for handlers to process
          observer.error(err);
        },
        complete() {
          observer.complete();
        },
      });

      return unsubscribe;
    });
  };
};
