import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-subscription", async () => {
  const { useSubscription } = await import("../mocks/subscription");
  return { useSubscription };
});
vi.mock("@/lib/trpc/client", async () => {
  const { useTRPC } = await import("../mocks/trpc");
  return { useTRPC };
});
vi.mock("@/components/dashboard/add-domain/share-instructions-dialog", async () => {
  const { ShareInstructionsDialog } = await import("../mocks/share-instructions");
  return { ShareInstructionsDialog };
});
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn<(message?: string) => void>(),
    error: vi.fn<(message?: string) => void>(),
    info: vi.fn<(message?: string) => void>(),
  },
}));

import { makeResumeDomain } from "@/components/dashboard/test-fixtures";
import { screen, waitFor } from "@/mocks/react";

import {
  addDomainActionSpies,
  addDomainMutation,
  mockSubscription,
  renderAddDomainContent,
  resetAddDomainTestState,
  verifyDomainMutation,
} from "./test-utils";

async function waitForStep2() {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Check Now" })).toBeInTheDocument();
  });
}

describe("AddDomainContent", () => {
  beforeEach(() => {
    resetAddDomainTestState();
  });

  afterEach(() => {
    resetAddDomainTestState();
  });

  it("adds a domain, shows DNS instructions, and calls onSuccess after verify", async () => {
    const user = userEvent.setup();
    renderAddDomainContent();

    expect(screen.getByRole("heading", { name: "Add Domain" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Domain name"), "newdomain.com");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitForStep2();
    expect(addDomainMutation.mock.calls[0]?.[0]).toEqual({ domain: "newdomain.com" });
    expect(screen.getByText("Recommended: Add a DNS record")).toBeInTheDocument();
    expect(screen.getByText("domainstack-verify=token-new")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Check Now" }));

    await waitFor(() => {
      expect(addDomainActionSpies.onSuccess).toHaveBeenCalledOnce();
    });
    expect(verifyDomainMutation.mock.calls[0]?.[0]).toEqual({ trackedDomainId: "domain-new" });
    expect(screen.getByRole("heading", { name: "Domain verified!" })).toBeInTheDocument();
    expect(screen.getByText("newdomain.com")).toBeInTheDocument();
  });

  it("shows the quota gate when the user cannot add more domains", () => {
    mockSubscription.canAddMore = false;
    mockSubscription.planQuota = 5;

    renderAddDomainContent();

    expect(screen.getByRole("heading", { name: "Domain Limit Reached" })).toBeInTheDocument();
    expect(screen.getByText(/You've reached your limit of 5 tracked domains/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Domain name")).not.toBeInTheDocument();
  });

  it("resumes verification on step 2 for a pending domain", async () => {
    renderAddDomainContent({ resumeDomain: makeResumeDomain() });

    await waitForStep2();
    expect(screen.getByRole("heading", { name: "Complete Verification" })).toBeInTheDocument();
    expect(screen.getByText("Verify ownership of pending.dev")).toBeInTheDocument();
    expect(screen.getByText("Recommended: Add a DNS record")).toBeInTheDocument();
    expect(screen.getByText("domainstack-verify=token-pending")).toBeInTheDocument();
    expect(addDomainMutation).not.toHaveBeenCalled();
  });

  it("stays on step 2 and shows troubleshooting when verification fails", async () => {
    const user = userEvent.setup();
    verifyDomainMutation.mockResolvedValueOnce({ verified: false, method: null });
    renderAddDomainContent({ resumeDomain: makeResumeDomain() });
    await waitForStep2();

    await user.click(screen.getByRole("button", { name: "Check Now" }));

    await waitFor(() => {
      expect(screen.getByText("Verification Failed")).toBeInTheDocument();
    });
    expect(screen.getByText("DNS Record Troubleshooting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check Again" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Complete Verification" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Domain verified!" })).not.toBeInTheDocument();
    expect(addDomainActionSpies.onSuccess).not.toHaveBeenCalled();
  });
});
