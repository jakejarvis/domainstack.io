import { vi } from "vitest";

import { AddDomainContent } from "@/components/dashboard/add-domain/add-domain-content";
import { mockSubscription } from "@/components/dashboard/mocks/subscription";
import { render } from "@/mocks/react";
import { resetTrpcMocks } from "@/mocks/trpc";
import type { ResumeDomainData } from "@domainstack/types";

export { mockSubscription } from "@/components/dashboard/mocks/subscription";
export { addDomainMutation, getVerificationDataQuery, verifyDomainMutation } from "@/mocks/trpc";

export const addDomainActionSpies = {
  onSuccess: vi.fn<() => void>(),
  onClose: vi.fn<() => void>(),
};

export function resetAddDomainTestState() {
  mockSubscription.plan = "pro";
  mockSubscription.planQuota = 100;
  mockSubscription.endsAt = null;
  mockSubscription.activeCount = 4;
  mockSubscription.archivedCount = 0;
  mockSubscription.canAddMore = true;
  for (const spy of Object.values(addDomainActionSpies)) {
    spy.mockClear();
  }
  resetTrpcMocks();
}

export type RenderAddDomainContentOptions = {
  resumeDomain?: ResumeDomainData | null;
  prefillDomain?: string;
  onSuccess?: () => void;
  onClose?: () => void;
};

export function renderAddDomainContent(options: RenderAddDomainContentOptions = {}) {
  return render(
    <AddDomainContent
      onSuccess={options.onSuccess ?? addDomainActionSpies.onSuccess}
      onClose={options.onClose ?? addDomainActionSpies.onClose}
      resumeDomain={options.resumeDomain}
      prefillDomain={options.prefillDomain}
    />,
  );
}
