import { QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc/client", async () => {
  const { useTRPC } = await import("@/components/dashboard/mocks/trpc");
  return { useTRPC };
});
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn<(message?: string) => void>(),
    error: vi.fn<(message?: string) => void>(),
    info: vi.fn<(message?: string) => void>(),
  },
}));

import {
  bulkArchiveDomainsMutation,
  bulkRemoveDomainsMutation,
  DOMAINS_QUERY_KEY,
  removeDomainMutation,
  resetTrpcMocks,
  SUBSCRIPTION_QUERY_KEY,
} from "@/components/dashboard/mocks/trpc";
import {
  DASHBOARD_TEST_NOW,
  makeDashboardDomains,
  makeTrackedDomain,
} from "@/components/dashboard/test-fixtures";
import { createTestQueryClient, renderHook, waitFor } from "@/mocks/react";
import type { TrackedDomainWithDetails } from "@domainstack/types";

import { useDashboardMutations } from "./use-dashboard-mutations";

type SubscriptionCache = {
  plan: "free" | "pro";
  planQuota: number;
  endsAt: Date | null;
  activeCount: number;
  archivedCount: number;
  canAddMore: boolean;
};

const archivedDomain = makeTrackedDomain({
  id: "domain-archived",
  domainName: "archived.com",
  archivedAt: DASHBOARD_TEST_NOW,
});

function defaultSubscription(overrides: Partial<SubscriptionCache> = {}): SubscriptionCache {
  return {
    plan: "pro",
    planQuota: 100,
    endsAt: null,
    activeCount: 4,
    archivedCount: 1,
    canAddMore: true,
    ...overrides,
  };
}

function getDomains(queryClient: ReturnType<typeof createTestQueryClient>) {
  return queryClient.getQueryData<TrackedDomainWithDetails[]>(DOMAINS_QUERY_KEY) ?? [];
}

function getSubscription(queryClient: ReturnType<typeof createTestQueryClient>) {
  return queryClient.getQueryData<SubscriptionCache>(SUBSCRIPTION_QUERY_KEY);
}

function renderDashboardMutations(options?: {
  domains?: TrackedDomainWithDetails[];
  subscription?: SubscriptionCache;
}) {
  const queryClient = createTestQueryClient();
  const domains = options?.domains ?? [...makeDashboardDomains(), archivedDomain];
  const subscription = options?.subscription ?? defaultSubscription();

  queryClient.setQueryData(DOMAINS_QUERY_KEY, domains);
  queryClient.setQueryData(SUBSCRIPTION_QUERY_KEY, subscription);

  const view = renderHook(() => useDashboardMutations(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  return { ...view, queryClient, domains };
}

describe("useDashboardMutations", () => {
  beforeEach(() => {
    resetTrpcMocks();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  afterEach(() => {
    resetTrpcMocks();
  });

  it("removes a domain and decrements active count", async () => {
    const { result, queryClient } = renderDashboardMutations({
      subscription: defaultSubscription({ planQuota: 4, canAddMore: false }),
    });

    result.current.remove("domain-alpha");

    await waitFor(() => {
      expect(getDomains(queryClient).map((d) => d.id)).not.toContain("domain-alpha");
    });
    expect(getSubscription(queryClient)).toMatchObject({
      activeCount: 3,
      archivedCount: 1,
      canAddMore: true,
    });
    expect(toast.success).toHaveBeenCalledWith("Domain removed");
    expect(removeDomainMutation.mock.calls[0]?.[0]).toEqual({ trackedDomainId: "domain-alpha" });
  });

  it("archives a domain and moves it from active to archived counts", async () => {
    const { result, queryClient } = renderDashboardMutations();

    result.current.archive("domain-alpha");

    await waitFor(() => {
      expect(
        getDomains(queryClient).find((d) => d.id === "domain-alpha")?.archivedAt,
      ).toBeInstanceOf(Date);
    });
    expect(getSubscription(queryClient)).toMatchObject({
      activeCount: 3,
      archivedCount: 2,
      canAddMore: true,
    });
    expect(toast.success).toHaveBeenCalledWith("Domain archived");
  });

  it("unarchives a domain and reverses the counts", async () => {
    const { result, queryClient } = renderDashboardMutations();

    result.current.unarchive("domain-archived");

    await waitFor(() => {
      expect(
        getDomains(queryClient).find((d) => d.id === "domain-archived")?.archivedAt,
      ).toBeNull();
    });
    expect(getSubscription(queryClient)).toMatchObject({
      activeCount: 5,
      archivedCount: 0,
      canAddMore: true,
    });
    expect(toast.success).toHaveBeenCalledWith("Domain reactivated");
  });

  it("mutes a domain without touching subscription cache", async () => {
    const { result, queryClient } = renderDashboardMutations();
    const subscriptionBefore = getSubscription(queryClient);

    result.current.setMuted("domain-alpha", true);

    await waitFor(() => {
      expect(getDomains(queryClient).find((d) => d.id === "domain-alpha")?.muted).toBe(true);
    });
    expect(getSubscription(queryClient)).toEqual(subscriptionBefore);
    expect(toast.success).toHaveBeenCalledWith("Domain muted");

    result.current.setMuted("domain-alpha", false);
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Domain unmuted");
    });
  });

  it("bulk-archives only non-archived ids when counting subscription changes", async () => {
    const { result, queryClient } = renderDashboardMutations();

    await result.current.bulkArchive(["domain-alpha", "domain-archived"]);

    const domains = getDomains(queryClient);
    expect(domains.find((d) => d.id === "domain-alpha")?.archivedAt).toBeInstanceOf(Date);
    expect(domains.find((d) => d.id === "domain-archived")?.archivedAt).toBeTruthy();
    expect(getSubscription(queryClient)).toMatchObject({
      activeCount: 3,
      archivedCount: 2,
    });
    expect(bulkArchiveDomainsMutation.mock.calls[0]?.[0]).toEqual({
      trackedDomainIds: ["domain-alpha", "domain-archived"],
    });
  });

  it("bulk-deletes ids and decrements active count only for non-archived domains", async () => {
    const { result, queryClient } = renderDashboardMutations();

    await result.current.bulkDelete(["domain-alpha", "domain-archived"]);

    const ids = getDomains(queryClient).map((d) => d.id);
    expect(ids).not.toContain("domain-alpha");
    expect(ids).not.toContain("domain-archived");
    expect(getSubscription(queryClient)).toMatchObject({
      activeCount: 3,
      archivedCount: 1,
    });
    expect(bulkRemoveDomainsMutation.mock.calls[0]?.[0]).toEqual({
      trackedDomainIds: ["domain-alpha", "domain-archived"],
    });
  });

  it("rolls back domains and subscription when remove fails", async () => {
    removeDomainMutation.mockRejectedValueOnce(new Error("nope"));
    const { result, queryClient } = renderDashboardMutations();
    const domainsBefore = getDomains(queryClient);
    const subscriptionBefore = getSubscription(queryClient);

    result.current.remove("domain-alpha");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to remove domain");
    });
    expect(getDomains(queryClient)).toEqual(domainsBefore);
    expect(getSubscription(queryClient)).toEqual(subscriptionBefore);
  });

  it("rolls back and toasts when bulk archive fails", async () => {
    bulkArchiveDomainsMutation.mockRejectedValueOnce(new Error("nope"));
    const { result, queryClient } = renderDashboardMutations();
    const domainsBefore = getDomains(queryClient);
    const subscriptionBefore = getSubscription(queryClient);

    await expect(result.current.bulkArchive(["domain-alpha"])).rejects.toThrow("nope");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to archive domains");
    });
    expect(getDomains(queryClient)).toEqual(domainsBefore);
    expect(getSubscription(queryClient)).toEqual(subscriptionBefore);
  });
});
