import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { getQueryClient, trpc } from "@/trpc/server";

export default async function DashboardPage() {
  // Prefetch dashboard queries in parallel for instant loading
  const queryClient = getQueryClient();
  void Promise.all([
    queryClient.prefetchQuery(trpc.user.getLimits.queryOptions()),
    queryClient.prefetchQuery(
      trpc.tracking.listDomains.queryOptions({ includeArchived: true }),
    ),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardContent />
    </HydrationBoundary>
  );
}
