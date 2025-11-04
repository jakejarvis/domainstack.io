"use client";

import { TRPCClientError, type TRPCLink } from "@trpc/client";
import type { AnyRouter } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { Siren } from "lucide-react";
import { toast } from "sonner";

function formatWait(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 1) return "a moment";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m <= 0) return `${sec}s`;
  if (m < 60) return sec ? `${m}m ${sec}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

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
                const friendly = formatWait(retryAfterSec);
                const title = service
                  ? `Too many ${service} requests`
                  : "You're doing that too much";
                toast.error(title, {
                  id: "rate-limit",
                  description: `Try again in ${friendly}.`,
                  icon: <Siren className="h-4 w-4" />,
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
