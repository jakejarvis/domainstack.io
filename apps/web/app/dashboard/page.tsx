import { noop } from "@tanstack/react-query";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export default async function DashboardPage() {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient
      .query(trpc.tracking.listDomains.queryOptions({ includeArchived: true }))
      .catch(noop),
    queryClient.query(trpc.user.getSubscription.queryOptions()).catch(noop),
  ]);

  return (
    <HydrateClient>
      <DashboardClient />
    </HydrateClient>
  );
}
