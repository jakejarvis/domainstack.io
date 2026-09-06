import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

vi.mock("@/lib/trpc/client", async () => {
  const { useTRPC } = await import("@/mocks/trpc");
  return { useTRPC };
});
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn<(message?: string, opts?: { description?: string }) => void>(),
    error: vi.fn<(message?: string, opts?: { description?: string }) => void>(),
    info: vi.fn<(message?: string) => void>(),
  },
}));

import { ShareInstructionsDialog } from "@/components/dashboard/add-domain/share-instructions-dialog";
import { render } from "@/mocks/react";
import { resetTrpcMocks, sendVerificationInstructionsMutation } from "@/mocks/trpc";

const DOMAIN = "pending.dev";
const TOKEN = "token-pending";
const TRACKED_ID = "domain-pending";

async function openShareDialog() {
  await render(
    <ShareInstructionsDialog
      domain={DOMAIN}
      verificationToken={TOKEN}
      trackedDomainId={TRACKED_ID}
    />,
  );
  await page.getByRole("button", { name: "Share" }).click();
  await expect
    .element(page.getByRole("heading", { name: "Share Verification Instructions" }))
    .toBeInTheDocument();
}

describe("ShareInstructionsDialog", () => {
  beforeEach(() => {
    resetTrpcMocks();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  afterEach(() => {
    resetTrpcMocks();
  });

  it("opens the three share options", async () => {
    await openShareDialog();

    await expect.element(page.getByText("Copy to Clipboard", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText("Download as File", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText("Send via Email", { exact: true })).toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Copy to clipboard" }))
      .toBeInTheDocument();
    await expect.element(page.getByPlaceholder(`admin@${DOMAIN}\u2026`)).toBeInTheDocument();
  });

  it("downloads instructions as a text file", async () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    await openShareDialog();
    await page.getByRole("button", { name: "Download instructions" }).click();

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith("Instructions downloaded!", {
      description: "Send this file to your domain admin.",
    });

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    click.mockRestore();
  });

  it("keeps Send enabled and shows an inline error for invalid email", async () => {
    await openShareDialog();

    const send = page.getByRole("button", { name: "Send email" });
    await expect.element(send).toBeEnabled();

    await send.click();
    await expect.element(page.getByText(/Enter an email address/)).toBeInTheDocument();

    await page.getByLabelText("Email address").fill("not-an-email");
    await send.click();
    await expect.element(page.getByText(/Enter a valid email address/)).toBeInTheDocument();
    expect(sendVerificationInstructionsMutation).not.toHaveBeenCalled();

    await page.getByLabelText("Email address").clear();
    await page.getByLabelText("Email address").fill("admin@pending.dev");
    await expect.element(send).toBeEnabled();
  });

  it("sends instructions to a trimmed email address", async () => {
    await openShareDialog();

    await page.getByLabelText("Email address").fill("  admin@pending.dev  ");
    await page.getByRole("button", { name: "Send email" }).click();

    await vi.waitFor(() => {
      expect(sendVerificationInstructionsMutation.mock.calls[0]?.[0]).toEqual({
        trackedDomainId: TRACKED_ID,
        recipientEmail: "admin@pending.dev",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Instructions sent!", {
      description: "Email sent to admin@pending.dev",
    });
  });

  it("toasts an error when sending fails so the user can retry", async () => {
    sendVerificationInstructionsMutation.mockRejectedValueOnce(new Error("nope"));
    await openShareDialog();

    await page.getByLabelText("Email address").fill("admin@pending.dev");
    await page.getByRole("button", { name: "Send email" }).click();

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to send email", {
        description: "Please try again or use another method.",
      });
    });

    const email = page.getByLabelText("Email address");
    await expect.element(email).toHaveValue("admin@pending.dev");
    await expect.element(page.getByRole("button", { name: "Send email" })).toBeEnabled();
    await page.getByRole("button", { name: "Send email" }).click();

    await vi.waitFor(() => {
      expect(sendVerificationInstructionsMutation).toHaveBeenCalledTimes(2);
    });
  });
});
