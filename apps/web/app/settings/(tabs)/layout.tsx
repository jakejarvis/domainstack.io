import { noop } from "@tanstack/react-query";

import { SettingsPanels, SettingsTabsRouter } from "@/components/settings/settings-content";
import { getServerSession } from "@/lib/auth/session";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export default async function SettingsTabsLayout() {
  const queryClient = getQueryClient();
  const [session] = await Promise.all([
    getServerSession(),
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
      <SettingsTabsRouter navigationMode="page">
        <SettingsPanels userEmail={session?.user.email ?? ""} />
      </SettingsTabsRouter>
    </HydrateClient>
  );
}
