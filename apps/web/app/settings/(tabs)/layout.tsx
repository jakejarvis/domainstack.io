import { noop } from "@tanstack/react-query";

import { SettingsTabsRouter } from "@/components/settings/settings-content";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { Card } from "@domainstack/ui/card";

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
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your subscription, notifications, and account preferences.
          </p>
        </div>

        <Card className="overflow-hidden border border-black/10 bg-background/80 p-3 shadow-xl backdrop-blur-xl dark:border-white/10 [&_[data-slot=tabs-content]]:mt-2 [&_[data-slot=tabs-content]]:p-2">
          <SettingsTabsRouter navigationMode="page" />
        </Card>
      </div>
    </HydrateClient>
  );
}
