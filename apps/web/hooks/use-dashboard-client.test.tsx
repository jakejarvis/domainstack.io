import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createStore, Provider as JotaiProvider } from "jotai";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc/client", async () => {
  const { useTRPC } = await import("@/mocks/trpc");
  return { useTRPC };
});
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn<(message?: string) => void>(),
    error: vi.fn<(message?: string) => void>(),
    info: vi.fn<(message?: string) => void>(),
    warning: vi.fn<(message?: string) => void>(),
  },
}));

import { makeDashboardDomains } from "@/components/dashboard/test-fixtures";
import { useTRPC } from "@/lib/trpc/client";
import { createTestQueryClient, renderHook } from "@/mocks/react";
import {
  getSubscriptionQuery,
  listDomainsQuery,
  resetTrpcMocks,
  setDomainsState,
  trpcKeys,
} from "@/mocks/trpc";

import { useDashboardClient } from "./use-dashboard-client";

async function renderDashboardClient({
  seedDomains,
  seedSubscription,
}: {
  seedDomains: boolean;
  seedSubscription: boolean;
}) {
  const queryClient = createTestQueryClient();
  const domainsKey = trpcKeys.tracking.listDomains.queryKey({ includeArchived: true });
  const subscriptionKey = trpcKeys.user.getSubscription.queryKey();

  if (seedDomains) {
    const domains = makeDashboardDomains();
    // Seed the cache and the mock server so the on-mount refetch returns the same rows.
    setDomainsState(domains);
    queryClient.setQueryData(domainsKey, domains);
  }
  if (seedSubscription) {
    queryClient.setQueryData(subscriptionKey, {
      plan: "pro",
      planQuota: 100,
      endsAt: null,
      activeCount: 4,
      archivedCount: 0,
      canAddMore: true,
    });
  }

  // Observe the same queries alongside the hook so tests can wait for the hook's own render
  // to see the error state before asserting on `hasError`.
  const view = await renderHook(
    () => {
      const trpc = useTRPC();
      const domainsQuery = useQuery(
        trpc.tracking.listDomains.queryOptions({ includeArchived: true }),
      );
      const subscriptionQuery = useQuery(trpc.user.getSubscription.queryOptions());
      return { dashboard: useDashboardClient(), domainsQuery, subscriptionQuery };
    },
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          <JotaiProvider store={createStore()}>
            <NuqsTestingAdapter>{children}</NuqsTestingAdapter>
          </JotaiProvider>
        </QueryClientProvider>
      ),
    },
  );

  return { ...view, queryClient };
}

describe("useDashboardClient hasError", () => {
  beforeEach(() => {
    resetTrpcMocks();
  });

  afterEach(() => {
    resetTrpcMocks();
  });

  it("keeps the loaded dashboard when a background refetch fails", async () => {
    const { result, queryClient } = await renderDashboardClient({
      seedDomains: true,
      seedSubscription: true,
    });
    await vi.waitFor(() => expect(result.current.dashboard.isLoading).toBe(false));

    listDomainsQuery.mockRejectedValue(new Error("domains refetch failed"));
    getSubscriptionQuery.mockRejectedValue(new Error("subscription refetch failed"));
    await queryClient.invalidateQueries();

    await vi.waitFor(() => {
      expect(result.current.domainsQuery.isError).toBe(true);
      expect(result.current.subscriptionQuery.isError).toBe(true);
    });
    // The failed refetch left the previous data in place.
    expect(result.current.domainsQuery.data).toBeDefined();
    expect(result.current.dashboard.hasError).toBe(false);
    expect(result.current.dashboard.domains.length).toBeGreaterThan(0);
    expect(result.current.dashboard.subscription).toBeDefined();
  });

  it("reports an error when nothing has loaded and the fetch fails", async () => {
    listDomainsQuery.mockRejectedValue(new Error("domains failed"));
    const { result } = await renderDashboardClient({
      seedDomains: false,
      seedSubscription: true,
    });

    await vi.waitFor(() => expect(result.current.dashboard.hasError).toBe(true));
  });
});
