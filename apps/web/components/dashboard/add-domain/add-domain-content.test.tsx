import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-subscription", async () => {
  const { useSubscription } = await import("../mocks/subscription");
  return { useSubscription };
});
vi.mock("@/lib/trpc/client", async () => {
  const { useTRPC } = await import("@/mocks/trpc");
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

import { AddDomainContent } from "@/components/dashboard/add-domain/add-domain-content";
import { makeResumeDomain } from "@/components/dashboard/test-fixtures";
import { DOMAIN_VALIDATION_ERROR } from "@/hooks/use-domain-verification";
import { screen, waitFor } from "@/mocks/react";

import {
  addDomainActionSpies,
  addDomainMutation,
  getVerificationDataQuery,
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
    expect(getVerificationDataQuery).not.toHaveBeenCalled();

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
    expect(getVerificationDataQuery).not.toHaveBeenCalled();
  });

  it("fetches verification data when resuming without a token", async () => {
    renderAddDomainContent({ resumeDomain: makeResumeDomain({ verificationToken: "" }) });

    await waitForStep2();
    await waitFor(() => {
      expect(getVerificationDataQuery).toHaveBeenCalledWith({ trackedDomainId: "domain-pending" });
    });
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

  it("normalizes the domain before adding it", async () => {
    const user = userEvent.setup();
    renderAddDomainContent();

    await user.type(screen.getByLabelText("Domain name"), "HTTPS://www.Example.COM/path");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitForStep2();
    expect(addDomainMutation.mock.calls[0]?.[0]).toEqual({ domain: "example.com" });
    expect(screen.getByText("domainstack-verify=token-new")).toBeInTheDocument();
  });

  it("shows an inline error for an invalid domain", async () => {
    const user = userEvent.setup();
    renderAddDomainContent();

    await user.type(screen.getByLabelText("Domain name"), "not a domain");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText(DOMAIN_VALIDATION_ERROR)).toBeInTheDocument();
    expect(addDomainMutation).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Check Now" })).not.toBeInTheDocument();
  });

  it("shows the same inline error when Enter is pressed on an invalid domain", async () => {
    const user = userEvent.setup();
    renderAddDomainContent();

    const input = screen.getByLabelText("Domain name");
    await user.type(input, "not a domain{Enter}");

    expect(screen.getByText(DOMAIN_VALIDATION_ERROR)).toBeInTheDocument();
    expect(addDomainMutation).not.toHaveBeenCalled();
  });

  it("remounts to step 1 when resume identity is replaced by a prefill", async () => {
    const { rerender } = renderAddDomainContent({ resumeDomain: makeResumeDomain() });
    await waitForStep2();

    rerender(
      <AddDomainContent
        onSuccess={addDomainActionSpies.onSuccess}
        onClose={addDomainActionSpies.onClose}
        prefillDomain="fresh.com"
      />,
    );

    expect(screen.getByRole("heading", { name: "Add Domain" })).toBeInTheDocument();
    expect(screen.getByLabelText("Domain name")).toHaveValue("fresh.com");
    expect(screen.queryByRole("button", { name: "Check Now" })).not.toBeInTheDocument();
  });
});
