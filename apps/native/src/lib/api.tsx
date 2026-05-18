import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { onlineManager, type QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import Constants from "expo-constants";
import * as Network from "expo-network";
import { useEffect, useRef, useState } from "react";
import superjson from "superjson";

import type { AppRouter } from "@domainstack/api";

import { authClient, getAuthCookieHeader } from "./auth";
import { apiBaseUrl } from "./env";
import { markNetworkStateKnown } from "./network";
import { makeQueryClient } from "./query-client";
import { resetUserScopedState } from "./reset-user-state";
import { buildTrpcHeaders } from "./trpc-headers";

const { TRPCProvider: BaseTRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export { useTRPC };

function useNetworkOnlineManager() {
  useEffect(() => {
    // Seed onlineManager from the first real reading. Until this resolves,
    // `assertOnline` treats the state as unknown→offline so an early mutation
    // can't slip past the offline guard.
    void Network.getNetworkStateAsync().then((state) => {
      onlineManager.setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
      markNetworkStateKnown();
    });

    const subscription = Network.addNetworkStateListener((state) => {
      onlineManager.setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
      markNetworkStateKnown();
    });

    return () => subscription.remove();
  }, []);
}

const persister = createAsyncStoragePersister({
  key: "domainstack-native-query-cache",
  storage: AsyncStorage,
});

// Wipe per-user state whenever the active user changes. Without this, the
// persisted query cache AND local stores (recent searches, portfolio filters)
// survive sign-out (or a direct A->B switch) and the next user on the same
// device can see the previous user's data before queries refetch.
function useResetCacheOnSignOut(queryClient: QueryClient) {
  const session = authClient.useSession();
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentUserId = session.data?.user?.id ?? null;
    const previousUserId = previousUserIdRef.current;
    previousUserIdRef.current = currentUserId;

    if (previousUserId !== null && previousUserId !== currentUserId) {
      queryClient.clear();
      void persister.removeClient();
      resetUserScopedState();
    }
  }, [queryClient, session.data]);
}

export function ApiProvider({ children }: { children: React.ReactNode }) {
  useNetworkOnlineManager();

  const [queryClient] = useState(() => makeQueryClient());
  useResetCacheOnSignOut(queryClient);
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
        // Tie the cache buster to the app version so a serialized-shape change
        // shipped in a release auto-invalidates any incompatible persisted
        // cache instead of deserializing stale data.
        buster: `domainstack-native-${Constants.expoConfig?.version ?? "dev"}`,
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
