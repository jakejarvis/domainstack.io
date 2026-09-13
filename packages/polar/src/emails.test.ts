import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserData } from "@domainstack/db/queries/users";

type SendEmailResult = {
  data: { id: string } | null;
  error: { name: string; message: string } | null;
};

const { sendEmail, getUserById } = vi.hoisted(() => ({
  sendEmail: vi.fn<(...args: unknown[]) => Promise<SendEmailResult>>(),
  getUserById: vi.fn<(userId: string) => Promise<UserData | null>>(),
}));

vi.mock("@domainstack/email", () => ({ sendEmail }));
vi.mock("@domainstack/db/queries/users", () => ({ getUserById }));
vi.mock("@domainstack/email/templates/pro-upgrade-success", () => ({
  default: vi.fn<(...args: unknown[]) => null>(() => null),
}));
vi.mock("@domainstack/email/templates/subscription-canceling", () => ({
  default: vi.fn<(...args: unknown[]) => null>(() => null),
}));
vi.mock("@domainstack/email/templates/subscription-expired", () => ({
  default: vi.fn<(...args: unknown[]) => null>(() => null),
}));

import {
  sendProUpgradeEmail,
  sendSubscriptionCancelingEmail,
  sendSubscriptionExpiredEmail,
} from "./emails";

describe("polar emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserById.mockResolvedValue({ id: "user-1", email: "u@example.com", name: "U" });
  });

  it("sendProUpgradeEmail resolves when the send succeeds", async () => {
    sendEmail.mockResolvedValue({ data: { id: "x" }, error: null });

    await expect(sendProUpgradeEmail("user-1")).resolves.toBeUndefined();
  });

  it("sendProUpgradeEmail rejects when Resend returns an error", async () => {
    sendEmail.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "bad" },
    });

    await expect(sendProUpgradeEmail("user-1")).rejects.toThrow(
      "Resend error sending pro upgrade email: validation_error - bad",
    );
  });

  it("sendSubscriptionExpiredEmail rejects when Resend returns an error", async () => {
    sendEmail.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "bad" },
    });

    await expect(sendSubscriptionExpiredEmail("user-1", 3)).rejects.toThrow(
      "Resend error sending subscription expired email: validation_error - bad",
    );
  });

  it("sendSubscriptionCancelingEmail returns without calling sendEmail when the user is not found", async () => {
    getUserById.mockResolvedValue(null);

    await expect(
      sendSubscriptionCancelingEmail("user-1", new Date("2026-01-01")),
    ).resolves.toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
