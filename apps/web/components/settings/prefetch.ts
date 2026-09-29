import "server-only";
import { noop } from "@tanstack/react-query";

import { getQueryClient, trpc } from "@/trpc/server";

/**
 * Start every query the settings panels read. The page awaits the result; the
 * intercepted modal fires it without awaiting so it can open immediately.
 */
export function prefetchSettingsQueries(): Promise<unknown> {
  const queryClient = getQueryClient();
  return Promise.all([
    queryClient.query(trpc.user.getSubscription.queryOptions()).catch(noop),
    queryClient.query(trpc.user.getLinkedAccounts.queryOptions()).catch(noop),
    queryClient.query(trpc.user.getNotificationPreferences.queryOptions()).catch(noop),
    queryClient
      .query(trpc.tracking.listDomains.queryOptions({ includeArchived: false }))
      .catch(noop),
    queryClient.query(trpc.user.getCalendarFeed.queryOptions()).catch(noop),
  ]);
}
