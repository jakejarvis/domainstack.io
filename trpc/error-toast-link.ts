"use client";

import { TRPCClientError, type TRPCLink } from "@trpc/client";
import type { AnyRouter } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { formatDistanceToNowStrict } from "date-fns";
import { Gauge } from "lucide-react";
import { createElement } from "react";
import { toast } from "sonner";

export function errorToastLink<
  TRouter extends AnyRouter = AnyRouter,
>(): TRPCLink<TRouter> {
  return () =>
    ({ next, op }) =>
      observable((observer) => {
        const sub = next(op).subscribe({
          next(value) {
            observer.next(value);
          },
          error(err) {
            if (err instanceof TRPCClientError) {
              const code = err.data?.code;
              if (code === "TOO_MANY_REQUESTS") {
                const retryAfterSec = Math.max(
                  1,
                  Math.round(Number(err.data?.retryAfter ?? 1)),
                );
                const service = err.data?.service as string | undefined;
                const retryUntil = new Date(Date.now() + retryAfterSec * 1000);
                const friendly = formatDistanceToNowStrict(retryUntil, {
                  addSuffix: true,
                });
                const title = service
                  ? `Too many ${service} requests`
                  : "You're doing that too much";
                toast.error(title, {
                  id: "rate-limit",
                  description: `Try again ${friendly}.`,
                  icon: createElement(Gauge, { className: "h-4 w-4" }),
                  position: "top-center",
                });
              }
            }
            observer.error(err);
          },
          complete() {
            observer.complete();
          },
        });
        return () => sub.unsubscribe();
      });
}
