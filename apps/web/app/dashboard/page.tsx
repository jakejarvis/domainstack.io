import { noop } from "@tanstack/react-query";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { getServerSession } from "@/lib/auth/session";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export default async function DashboardPage() {
  const queryClient = getQueryClient();
  const [session] = await Promise.all([
    getServerSession(),
    queryClient
      .query(trpc.tracking.listDomains.queryOptions({ includeArchived: true }))
      .catch(noop),
    queryClient.query(trpc.user.getSubscription.queryOptions()).catch(noop),
  ]);

  return (
    <HydrateClient>
      <DashboardClient userName={session?.user?.name ?? ""} />
    </HydrateClient>
  );
}
