import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { onlineManager } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import * as Network from "expo-network";
import { useEffect, useState } from "react";
import superjson from "superjson";

import type { AppRouter } from "@domainstack/api";

import { getAuthCookieHeader } from "./auth";
import { apiBaseUrl } from "./env";
import { makeQueryClient } from "./query-client";
import { buildTrpcHeaders } from "./trpc-headers";

const { TRPCProvider: BaseTRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export { useTRPC };

function useNetworkOnlineManager() {
  useEffect(() => {
    const subscription = Network.addNetworkStateListener((state) => {
      onlineManager.setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });

    return () => subscription.remove();
  }, []);
}

const persister = createAsyncStoragePersister({
  key: "domainstack-native-query-cache",
  storage: AsyncStorage,
});

export function ApiProvider({ children }: { children: React.ReactNode }) {
  useNetworkOnlineManager();

  const [queryClient] = useState(() => makeQueryClient());
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
        httpBatchLink({
          url: `${apiBaseUrl}/api/trpc`,
          transformer: superjson,
          headers: () => buildTrpcHeaders(getAuthCookieHeader()),
          fetch: (url, options) => fetch(url, { ...options, credentials: "omit" }),
        }),
      ],
    }),
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        buster: "domainstack-native-v1",
        maxAge: 1000 * 60 * 60 * 24,
        persister,
      }}
    >
      <BaseTRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </BaseTRPCProvider>
    </PersistQueryClientProvider>
  );
}
