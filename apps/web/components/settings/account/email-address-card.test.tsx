import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

const auth = vi.hoisted(() => ({
  changeEmail: vi.fn<(opts: { newEmail: string; callbackURL: string }) => Promise<unknown>>(),
}));

vi.mock("@domainstack/auth/client", () => ({
  changeEmail: auth.changeEmail,
}));
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn<(message?: string, opts?: { description?: string }) => void>(),
    error: vi.fn<(message?: string, opts?: { description?: string }) => void>(),
  },
}));

import { EmailAddressCard } from "@/components/settings/account/email-address-card";
import { render } from "@/mocks/react";

async function openForm() {
  await render(<EmailAddressCard email="current@example.com" />);
  await page.getByRole("button", { name: "Change email address" }).click();
  return page.getByRole("textbox", { name: "New email address" });
}

describe("EmailAddressCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the current address and focuses the field when the form opens", async () => {
    await render(<EmailAddressCard email="current@example.com" />);
    await expect.element(page.getByText("current@example.com")).toBeVisible();

    await page.getByRole("button", { name: "Change email address" }).click();
    const input = page.getByRole("textbox", { name: "New email address" });
    await expect.element(input).toBeVisible();
    await expect.element(input).toHaveFocus();
  });

  it.each([
    ["", "Enter an email address, like you@example.com."],
    ["not-an-email", "Enter a valid email address, like you@example.com."],
    ["  CURRENT@example.com ", "That's already your email address."],
  ])("rejects %j without calling the server", async (value, message) => {
    const input = await openForm();
    if (value) await input.fill(value);
    await page.getByRole("button", { name: "Send confirmation link" }).click();

    await expect.element(page.getByRole("alert")).toHaveTextContent(message);
    expect(auth.changeEmail).not.toHaveBeenCalled();
  });

  it("sends the link on Enter and moves focus to the confirmation message", async () => {
    auth.changeEmail.mockResolvedValue({ data: { status: true }, error: null });
    const input = await openForm();
    await input.fill("  new@example.com ");
    await userEvent.keyboard("{Enter}");

    await vi.waitFor(() => expect(auth.changeEmail).toHaveBeenCalledTimes(1));
    expect(auth.changeEmail).toHaveBeenCalledWith({
      newEmail: "new@example.com",
      callbackURL: "/settings/account?email_change=1",
    });

    const status = page.getByRole("status").filter({ hasText: "new@example.com" });
    await expect.element(status).toBeVisible();
    await expect.element(status).toHaveFocus();
  });

  it("toasts the rate limit and keeps the form open when the server returns 429", async () => {
    auth.changeEmail.mockResolvedValue({
      data: null,
      error: { status: 429, message: "Too many requests" },
    });
    const input = await openForm();
    await input.fill("new@example.com");
    await page.getByRole("button", { name: "Send confirmation link" }).click();

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't send the confirmation link.",
      expect.objectContaining({ description: expect.stringContaining("hour") }),
    );
    await expect.element(input).toBeVisible();
    await expect.element(input).toBeEnabled();
  });

  it("returns focus to Change when the form is cancelled", async () => {
    await openForm();
    await page.getByRole("button", { name: "Cancel" }).click();

    const change = page.getByRole("button", { name: "Change email address" });
    await expect.element(change).toBeVisible();
    await expect.element(change).toHaveFocus();
  });
});
