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
import { queryPersister, shouldDehydrateQuery } from "./query-persister";
import { resetUserScopedState } from "./reset-user-state";
import { resetSignOutGuard } from "./trpc-error-handler";
import { buildTrpcHeaders } from "./trpc-headers";

const { TRPCProvider: BaseTRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export { useTRPC };

function useNetworkOnlineManager() {
  useEffect(() => {
    const apply = (state: Network.NetworkState) => {
      onlineManager.setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
      markNetworkStateKnown();
    };

    // Seed onlineManager from the first real reading. Until this resolves,
    // `assertOnline` treats the state as unknown→offline so an early mutation
    // can't slip past the offline guard. A rejected probe must still mark the
    // state "known" — otherwise `assertOnline` would treat the device as
    // permanently offline, since the listener only fires on subsequent change.
    void Network.getNetworkStateAsync()
      .then(apply)
      .catch(() => markNetworkStateKnown());

    const subscription = Network.addNetworkStateListener(apply);

    return () => subscription.remove();
  }, []);
}

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
      void queryPersister.removeClient();
      resetUserScopedState();
      // Session transition observed and cache cleared — re-arm the auto
      // sign-out guard for the next session's potential expiry.
      resetSignOutGuard();
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
        dehydrateOptions: { shouldDehydrateQuery },
        maxAge: 1000 * 60 * 60 * 24,
        persister: queryPersister,
      }}
    >
      <BaseTRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </BaseTRPCProvider>
    </PersistQueryClientProvider>
  );
}
