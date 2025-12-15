import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { headers } from "next/headers";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { auth } from "@/lib/auth";
import { getQueryClient, trpc } from "@/trpc/server";

export default async function DashboardPage() {
  // Check if we have a session before prefetching
  // During prerendering, there's no session and we skip prefetch
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const queryClient = getQueryClient();

  // Only prefetch if we have an authenticated user
  if (session?.user) {
    void Promise.all([
      queryClient.prefetchQuery(trpc.user.getSubscription.queryOptions()),
      queryClient.prefetchQuery(
        trpc.tracking.listDomains.queryOptions({ includeArchived: true }),
      ),
    ]);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardContent />
    </HydrationBoundary>
  );
}
