"use client";

import { isServer, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createTRPCClient,
  httpBatchStreamLink,
  loggerLink,
} from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";
import { TRPCProvider as Provider } from "@/lib/trpc/client";
import type { AppRouter } from "@/server/routers/_app";
import { errorToastLink } from "@/trpc/error-toast-link";
import { makeQueryClient } from "@/trpc/query-client";

let browserQueryClient: ReturnType<typeof makeQueryClient> | undefined;

export function getQueryClient() {
  // Server: always make a new query client
  if (isServer) return makeQueryClient();
  // Browser: make a new query client if we don't already have one
  // This is very important, so we don't re-make a new client if React
  // suspends during the initial render. This may not be needed if we
  // have a suspense boundary BELOW the creation of the query client
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

const getBaseUrl = () => {
  if (typeof window !== "undefined") return ""; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
};

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
        errorToastLink(),
        httpBatchStreamLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          headers: () => {
            const headers = new Headers();
            headers.set("x-trpc-source", "nextjs-react");

            // For SSR on Vercel with deployment protection:
            // Add bypass token to allow server-to-server calls
            if (isServer && process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
              headers.set(
                "x-vercel-protection-bypass",
                process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
              );
            }

            return headers;
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Provider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
        {process.env.NODE_ENV === "development" && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </Provider>
    </QueryClientProvider>
  );
}
