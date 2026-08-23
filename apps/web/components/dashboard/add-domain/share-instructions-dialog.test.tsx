import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@domainstack/ui/toast";

vi.mock("@/lib/trpc/client", async () => {
  const { useTRPC } = await import("@/mocks/trpc");
  return { useTRPC };
});
vi.mock("@domainstack/ui/toast", () => ({
  toast: {
    add: vi.fn<(options?: { title?: string; description?: string; type?: string }) => void>(),
  },
}));

import { ShareInstructionsDialog } from "@/components/dashboard/add-domain/share-instructions-dialog";
import { render, screen, waitFor } from "@/mocks/react";
import { resetTrpcMocks, sendVerificationInstructionsMutation } from "@/mocks/trpc";

const DOMAIN = "pending.dev";
const TOKEN = "token-pending";
const TRACKED_ID = "domain-pending";

async function openShareDialog(user: ReturnType<typeof userEvent.setup>) {
  render(
    <ShareInstructionsDialog
      domain={DOMAIN}
      verificationToken={TOKEN}
      trackedDomainId={TRACKED_ID}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Share" }));
  expect(
    await screen.findByRole("heading", { name: "Share Verification Instructions" }),
  ).toBeInTheDocument();
}

describe("ShareInstructionsDialog", () => {
  beforeEach(() => {
    resetTrpcMocks();
    vi.mocked(toast.add).mockClear();
  });

  afterEach(() => {
    resetTrpcMocks();
  });

  it("opens the three share options", async () => {
    const user = userEvent.setup();
    await openShareDialog(user);

    expect(screen.getByText("Copy to clipboard")).toBeInTheDocument();
    expect(screen.getByText("Download as file")).toBeInTheDocument();
    expect(screen.getByText("Send via email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy to clipboard" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(`admin@${DOMAIN}`)).toBeInTheDocument();
  });

  it("downloads instructions as a text file", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    await openShareDialog(user);
    await user.click(screen.getByRole("button", { name: "Download instructions" }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(toast.add).toHaveBeenCalledWith({
      title: "Instructions downloaded!",
      description: "Send this file to your domain admin.",
      type: "success",
    });

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    click.mockRestore();
  });

  it("keeps Send disabled until the email is valid", async () => {
    const user = userEvent.setup();
    await openShareDialog(user);

    const send = screen.getByRole("button", { name: "Send email" });
    expect(send).toBeDisabled();

    await user.type(screen.getByLabelText("Email address"), "not-an-email");
    expect(send).toBeDisabled();

    await user.clear(screen.getByLabelText("Email address"));
    await user.type(screen.getByLabelText("Email address"), "admin@pending.dev");
    expect(send).toBeEnabled();
  });

  it("sends instructions to a trimmed email address", async () => {
    const user = userEvent.setup();
    await openShareDialog(user);

    await user.type(screen.getByLabelText("Email address"), "  admin@pending.dev  ");
    await user.click(screen.getByRole("button", { name: "Send email" }));

    await waitFor(() => {
      expect(sendVerificationInstructionsMutation.mock.calls[0]?.[0]).toEqual({
        trackedDomainId: TRACKED_ID,
        recipientEmail: "admin@pending.dev",
      });
    });
    expect(toast.add).toHaveBeenCalledWith({
      title: "Instructions sent!",
      description: "Email sent to admin@pending.dev",
      type: "success",
    });
  });

  it("toasts an error when sending fails so the user can retry", async () => {
    const user = userEvent.setup();
    sendVerificationInstructionsMutation.mockRejectedValueOnce(new Error("nope"));
    await openShareDialog(user);

    await user.type(screen.getByLabelText("Email address"), "admin@pending.dev");
    await user.click(screen.getByRole("button", { name: "Send email" }));

    await waitFor(() => {
      expect(toast.add).toHaveBeenCalledWith({
        title: "Failed to send email",
        description: "Please try again or use another method.",
        type: "error",
      });
    });

    const email = screen.getByLabelText("Email address");
    expect(email).toHaveValue("admin@pending.dev");
    expect(screen.getByRole("button", { name: "Send email" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Send email" }));

    await waitFor(() => {
      expect(sendVerificationInstructionsMutation).toHaveBeenCalledTimes(2);
    });
  });
});
