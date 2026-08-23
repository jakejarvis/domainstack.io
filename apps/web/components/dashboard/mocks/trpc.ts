import { vi } from "vitest";

import type { VerificationMethod } from "@domainstack/constants";

type AddDomainInput = { domain: string };
type AddDomainResult = {
  id: string;
  domain: string;
  verificationToken: string;
  resumed: boolean;
};

type VerifyDomainInput = { trackedDomainId: string; method?: VerificationMethod };
type VerifyDomainResult = { verified: boolean; method: VerificationMethod | null };

type GetVerificationDataInput = { trackedDomainId: string };
type GetVerificationDataResult = {
  domain: string;
  verificationToken: string;
  verificationMethod: VerificationMethod | null;
};

type TrackedDomainIdInput = { trackedDomainId: string };
type BulkDomainIdsInput = { trackedDomainIds: string[] };
type BulkMutationResult = { successCount: number; failedCount: number };
type SetMutedInput = { trackedDomainId: string; muted: boolean };

export const DOMAINS_QUERY_KEY = ["tracking", "listDomains"] as const;
export const SUBSCRIPTION_QUERY_KEY = ["user", "getSubscription"] as const;

export const addDomainMutation = vi.fn<(input: AddDomainInput) => Promise<AddDomainResult>>(
  async ({ domain }) => ({
    id: "domain-new",
    domain,
    verificationToken: "token-new",
    resumed: false,
  }),
);

export const verifyDomainMutation = vi.fn<
  (input: VerifyDomainInput) => Promise<VerifyDomainResult>
>(async () => ({
  verified: true,
  method: "dns_txt",
}));

export const getVerificationDataQuery = vi.fn<
  (input: GetVerificationDataInput) => Promise<GetVerificationDataResult>
>(async () => ({
  domain: "pending.dev",
  verificationToken: "token-pending",
  verificationMethod: "dns_txt",
}));

export const removeDomainMutation = vi.fn<(input: TrackedDomainIdInput) => Promise<{ ok: true }>>(
  async () => ({ ok: true }),
);

export const archiveDomainMutation = vi.fn<(input: TrackedDomainIdInput) => Promise<{ ok: true }>>(
  async () => ({ ok: true }),
);

export const unarchiveDomainMutation = vi.fn<
  (input: TrackedDomainIdInput) => Promise<{ ok: true }>
>(async () => ({ ok: true }));

export const bulkArchiveDomainsMutation = vi.fn<
  (input: BulkDomainIdsInput) => Promise<BulkMutationResult>
>(async ({ trackedDomainIds }) => ({
  successCount: trackedDomainIds.length,
  failedCount: 0,
}));

export const bulkRemoveDomainsMutation = vi.fn<
  (input: BulkDomainIdsInput) => Promise<BulkMutationResult>
>(async ({ trackedDomainIds }) => ({
  successCount: trackedDomainIds.length,
  failedCount: 0,
}));

export const setDomainMutedMutation = vi.fn<(input: SetMutedInput) => Promise<{ ok: true }>>(
  async () => ({ ok: true }),
);

export function resetTrpcMocks() {
  addDomainMutation.mockReset();
  addDomainMutation.mockImplementation(async ({ domain }) => ({
    id: "domain-new",
    domain,
    verificationToken: "token-new",
    resumed: false,
  }));

  verifyDomainMutation.mockReset();
  verifyDomainMutation.mockImplementation(async () => ({
    verified: true,
    method: "dns_txt",
  }));

  getVerificationDataQuery.mockReset();
  getVerificationDataQuery.mockImplementation(async () => ({
    domain: "pending.dev",
    verificationToken: "token-pending",
    verificationMethod: "dns_txt",
  }));

  removeDomainMutation.mockReset();
  removeDomainMutation.mockImplementation(async () => ({ ok: true }));

  archiveDomainMutation.mockReset();
  archiveDomainMutation.mockImplementation(async () => ({ ok: true }));

  unarchiveDomainMutation.mockReset();
  unarchiveDomainMutation.mockImplementation(async () => ({ ok: true }));

  bulkArchiveDomainsMutation.mockReset();
  bulkArchiveDomainsMutation.mockImplementation(async ({ trackedDomainIds }) => ({
    successCount: trackedDomainIds.length,
    failedCount: 0,
  }));

  bulkRemoveDomainsMutation.mockReset();
  bulkRemoveDomainsMutation.mockImplementation(async ({ trackedDomainIds }) => ({
    successCount: trackedDomainIds.length,
    failedCount: 0,
  }));

  setDomainMutedMutation.mockReset();
  setDomainMutedMutation.mockImplementation(async () => ({ ok: true }));
}

export function useTRPC() {
  return {
    tracking: {
      addDomain: {
        mutationOptions: () => ({ mutationFn: addDomainMutation }),
      },
      verifyDomain: {
        mutationOptions: () => ({ mutationFn: verifyDomainMutation }),
      },
      getVerificationData: {
        queryOptions: (input: GetVerificationDataInput) => ({
          queryKey: ["tracking", "getVerificationData", input] as const,
          queryFn: () => getVerificationDataQuery(input),
        }),
      },
      listDomains: {
        queryKey: () => DOMAINS_QUERY_KEY,
      },
      removeDomain: {
        mutationOptions: () => ({ mutationFn: removeDomainMutation }),
      },
      archiveDomain: {
        mutationOptions: () => ({ mutationFn: archiveDomainMutation }),
      },
      unarchiveDomain: {
        mutationOptions: () => ({ mutationFn: unarchiveDomainMutation }),
      },
      bulkArchiveDomains: {
        mutationOptions: () => ({ mutationFn: bulkArchiveDomainsMutation }),
      },
      bulkRemoveDomains: {
        mutationOptions: () => ({ mutationFn: bulkRemoveDomainsMutation }),
      },
      sendVerificationInstructions: {
        mutationOptions: () => ({
          mutationFn: vi.fn<(input: unknown) => Promise<{ sent: boolean }>>(async () => ({
            sent: true,
          })),
        }),
      },
    },
    user: {
      getSubscription: {
        queryKey: () => SUBSCRIPTION_QUERY_KEY,
      },
      setDomainMuted: {
        mutationOptions: () => ({ mutationFn: setDomainMutedMutation }),
      },
    },
  };
}
