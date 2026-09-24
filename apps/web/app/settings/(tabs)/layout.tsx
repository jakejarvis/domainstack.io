import { noop } from "@tanstack/react-query";

import { SettingsTabsRouter } from "@/components/settings/settings-content";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export default async function SettingsTabsLayout() {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.query(trpc.user.getSubscription.queryOptions()).catch(noop),
    queryClient.query(trpc.user.getLinkedAccounts.queryOptions()).catch(noop),
    queryClient.query(trpc.user.getNotificationPreferences.queryOptions()).catch(noop),
    queryClient
      .query(trpc.tracking.listDomains.queryOptions({ includeArchived: false }))
      .catch(noop),
    queryClient.query(trpc.user.getCalendarFeed.queryOptions()).catch(noop),
  ]);

  return (
    <HydrateClient>
      <div className="sm:overflow-hidden sm:rounded-xl sm:border sm:bg-background sm:p-3 sm:shadow-sm [&_[data-slot=tabs-content]]:mt-2 sm:[&_[data-slot=tabs-content]]:p-2">
        <SettingsTabsRouter navigationMode="page" />
      </div>
    </HydrateClient>
  );
}
