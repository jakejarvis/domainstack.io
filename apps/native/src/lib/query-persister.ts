import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { defaultShouldDehydrateQuery, type Query } from "@tanstack/react-query";
import type { PersistedClient } from "@tanstack/react-query-persist-client";
import superjson from "superjson";

export const QUERY_CACHE_KEY = "domainstack-native-query-cache";

// The tRPC client uses superjson, so the in-memory query cache holds rich
// values (Date, etc.). The persister MUST serialize with superjson too — the
// default JSON.stringify/parse would silently coerce persisted Dates into
// ISO strings, so any date math/formatting on portfolio, subscription, or
// notification data breaks on the cold-start-with-warm-cache path (the one
// path normal dev/hot-reload testing never exercises).
export function serializeQueryClient(client: PersistedClient): string {
  return superjson.stringify(client);
}

export function deserializeQueryClient(cached: string): PersistedClient {
  return superjson.parse(cached);
}

// Never persist a query that is still invalidated (awaiting a reconciling
// refetch after an optimistic mutation). If that refetch is interrupted —
// offline, or the app killed before `onSettled` invalidation refetches — the
// raw optimistic snapshot would otherwise freeze into AsyncStorage. The worst
// case is "mark all read": the optimistic empty inbox + unreadCount 0 would
// survive a cold start and mask notifications that arrived in between. Omitting
// invalidated queries means they're simply refetched fresh on next launch.
export function shouldDehydrateQuery(query: Query): boolean {
  return defaultShouldDehydrateQuery(query) && !query.state.isInvalidated;
}

export const queryPersister = createAsyncStoragePersister({
  key: QUERY_CACHE_KEY,
  storage: AsyncStorage,
  serialize: serializeQueryClient,
  deserialize: deserializeQueryClient,
});
