import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { MonitoredDomainsList } from "@/components/account/monitored-domains-list";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Monitored Domains & Alerts",
  description: "Manage your domain monitoring and alert preferences",
};

export default async function MonitorsPage() {
  const queryClient = getQueryClient();

  // Prefetch monitored domains
  await queryClient.prefetchQuery(
    trpc.monitoring.getMonitoredDomains.queryOptions(),
  );

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6">
        <h1 className="font-bold text-3xl">Monitored Domains & Alerts</h1>
        <p className="mt-2 text-muted-foreground">
          Manage notifications for domain and certificate expiry
        </p>
      </div>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <MonitoredDomainsList />
      </HydrationBoundary>
    </div>
  );
}
