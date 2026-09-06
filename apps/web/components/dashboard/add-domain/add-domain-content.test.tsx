import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

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
  await expect.element(page.getByRole("button", { name: "Check Now" })).toBeInTheDocument();
}

describe("AddDomainContent", () => {
  beforeEach(() => {
    resetAddDomainTestState();
  });

  afterEach(() => {
    resetAddDomainTestState();
  });

  it("adds a domain, shows DNS instructions, and calls onSuccess after verify", async () => {
    await renderAddDomainContent();

    await expect.element(page.getByRole("heading", { name: "Add Domain" })).toBeInTheDocument();
    expect(getVerificationDataQuery).not.toHaveBeenCalled();

    await page.getByLabelText("Domain name").fill("newdomain.com");
    await page.getByRole("button", { name: "Continue" }).click();

    await waitForStep2();
    expect(addDomainMutation.mock.calls[0]?.[0]).toEqual({ domain: "newdomain.com" });
    await expect
      .element(page.getByText("Recommended: Add a DNS record", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("domainstack-verify=token-new", { exact: true }))
      .toBeInTheDocument();

    await page.getByRole("button", { name: "Check Now" }).click();

    await vi.waitFor(() => {
      expect(addDomainActionSpies.onSuccess).toHaveBeenCalledOnce();
    });
    expect(verifyDomainMutation.mock.calls[0]?.[0]).toEqual({ trackedDomainId: "domain-new" });
    await expect
      .element(page.getByRole("heading", { name: "Domain verified!" }))
      .toBeInTheDocument();
    await expect.element(page.getByText("newdomain.com", { exact: true })).toBeInTheDocument();
  });

  it("shows the quota gate when the user cannot add more domains", async () => {
    mockSubscription.canAddMore = false;
    mockSubscription.planQuota = 5;

    await renderAddDomainContent();

    await expect
      .element(page.getByRole("heading", { name: "Domain Limit Reached" }))
      .toBeInTheDocument();
    await expect
      .element(page.getByText(/You've reached your limit of 5 tracked domains/))
      .toBeInTheDocument();
    await expect.element(page.getByLabelText("Domain name")).not.toBeInTheDocument();
  });

  it("resumes verification on step 2 for a pending domain", async () => {
    await renderAddDomainContent({ resumeDomain: makeResumeDomain() });

    await waitForStep2();
    await expect
      .element(page.getByRole("heading", { name: "Complete Verification" }))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Verify ownership of pending.dev", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Recommended: Add a DNS record", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("domainstack-verify=token-pending", { exact: true }))
      .toBeInTheDocument();
    expect(addDomainMutation).not.toHaveBeenCalled();
    expect(getVerificationDataQuery).not.toHaveBeenCalled();
  });

  it("fetches verification data when resuming without a token", async () => {
    await renderAddDomainContent({ resumeDomain: makeResumeDomain({ verificationToken: "" }) });

    await waitForStep2();
    await vi.waitFor(() => {
      expect(getVerificationDataQuery).toHaveBeenCalledWith({ trackedDomainId: "domain-pending" });
    });
    await expect
      .element(page.getByText("domainstack-verify=token-pending", { exact: true }))
      .toBeInTheDocument();
    expect(addDomainMutation).not.toHaveBeenCalled();
  });

  it("stays on step 2 and shows troubleshooting when verification fails", async () => {
    verifyDomainMutation.mockResolvedValueOnce({ verified: false, method: null });
    await renderAddDomainContent({ resumeDomain: makeResumeDomain() });
    await waitForStep2();

    await page.getByRole("button", { name: "Check Now" }).click();

    await expect
      .element(page.getByText("Verification Failed", { exact: true }))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("DNS Record Troubleshooting", { exact: true }))
      .toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Check Again" })).toBeInTheDocument();
    await expect
      .element(page.getByRole("heading", { name: "Complete Verification" }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("heading", { name: "Domain verified!" }))
      .not.toBeInTheDocument();
    expect(addDomainActionSpies.onSuccess).not.toHaveBeenCalled();
  });

  it("normalizes the domain before adding it", async () => {
    await renderAddDomainContent();

    await page.getByLabelText("Domain name").fill("HTTPS://www.Example.COM/path");
    await page.getByRole("button", { name: "Continue" }).click();

    await waitForStep2();
    expect(addDomainMutation.mock.calls[0]?.[0]).toEqual({ domain: "example.com" });
    await expect
      .element(page.getByText("domainstack-verify=token-new", { exact: true }))
      .toBeInTheDocument();
  });

  it("shows an inline error for an invalid domain", async () => {
    await renderAddDomainContent();

    await page.getByLabelText("Domain name").fill("not a domain");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect
      .element(page.getByText(DOMAIN_VALIDATION_ERROR, { exact: true }))
      .toBeInTheDocument();
    expect(addDomainMutation).not.toHaveBeenCalled();
    await expect.element(page.getByRole("button", { name: "Check Now" })).not.toBeInTheDocument();
  });

  it("shows the same inline error when Enter is pressed on an invalid domain", async () => {
    await renderAddDomainContent();

    const input = page.getByLabelText("Domain name");
    await userEvent.type(input, "not a domain{Enter}");

    await expect
      .element(page.getByText(DOMAIN_VALIDATION_ERROR, { exact: true }))
      .toBeInTheDocument();
    expect(addDomainMutation).not.toHaveBeenCalled();
  });

  it("remounts to step 1 when resume identity is replaced by a prefill", async () => {
    const { rerender } = await renderAddDomainContent({ resumeDomain: makeResumeDomain() });
    await waitForStep2();

    await rerender(
      <AddDomainContent
        onSuccess={addDomainActionSpies.onSuccess}
        onClose={addDomainActionSpies.onClose}
        prefillDomain="fresh.com"
      />,
    );

    await expect.element(page.getByRole("heading", { name: "Add Domain" })).toBeInTheDocument();
    await expect.element(page.getByLabelText("Domain name")).toHaveValue("fresh.com");
    await expect.element(page.getByRole("button", { name: "Check Now" })).not.toBeInTheDocument();
  });
});
