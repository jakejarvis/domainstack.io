import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* @vitest-environment node */
import { formatDateLong } from "@domainstack/utils/date";

const mocks = vi.hoisted(() => ({
  getUserWithEndingSubscription: vi.fn<(userId: string) => Promise<unknown>>(),
  setLastExpiryNotification: vi.fn<(userId: string, threshold: number) => Promise<void>>(),
  sendEmail: vi.fn<(params: { to: string; subject: string; react: unknown }) => Promise<unknown>>(),
  SubscriptionCancelingEmail: vi.fn<(props: unknown) => unknown>(),
}));

vi.mock("@domainstack/db/queries/user-subscription", () => ({
  getUserWithEndingSubscription: mocks.getUserWithEndingSubscription,
  setLastExpiryNotification: mocks.setLastExpiryNotification,
}));

vi.mock("../steps/email", () => ({
  sendEmail: mocks.sendEmail,
  getBaseUrl: () => "https://test.domainstack.io",
  getFirstName: (name: string) => name.split(" ")[0],
}));

vi.mock("@domainstack/email/templates/subscription-canceling", () => ({
  default: mocks.SubscriptionCancelingEmail,
}));

import { subscriptionExpiryWorkflow } from "./workflow";

const NOW = new Date("2026-10-01T12:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function user(endsAt: Date, lastExpiryNotification: number | null) {
  return {
    userId: "u1",
    userName: "Alex Doe",
    userEmail: "a@example.com",
    endsAt,
    lastExpiryNotification,
  };
}

function sentSubject(): string {
  return mocks.sendEmail.mock.calls[0][0].subject;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.resetAllMocks();
  mocks.sendEmail.mockResolvedValue({ emailId: "e1" });
  mocks.setLastExpiryNotification.mockResolvedValue(undefined);
  mocks.SubscriptionCancelingEmail.mockReturnValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("subscriptionExpiryWorkflow", () => {
  it("skips a subscription ending beyond the largest threshold", async () => {
    mocks.getUserWithEndingSubscription.mockResolvedValue(
      user(new Date(NOW.getTime() + 8 * DAY), null),
    );

    const result = await subscriptionExpiryWorkflow({ userId: "u1" });

    expect(result).toMatchObject({ skipped: true, reason: "out_of_range" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("sends the 7-day reminder with the end date in the subject", async () => {
    const endsAt = new Date(NOW.getTime() + 7 * DAY);
    mocks.getUserWithEndingSubscription.mockResolvedValue(user(endsAt, null));

    const result = await subscriptionExpiryWorkflow({ userId: "u1" });

    expect(result).toMatchObject({ skipped: false, sent: true, threshold: 7 });
    expect(sentSubject()).toBe(`Your Pro subscription ends on ${formatDateLong(endsAt)}`);
    expect(mocks.setLastExpiryNotification).toHaveBeenCalledWith("u1", 7);
  });

  it("sends the 3-day reminder as urgent", async () => {
    mocks.getUserWithEndingSubscription.mockResolvedValue(
      user(new Date(NOW.getTime() + 3 * DAY), 7),
    );

    const result = await subscriptionExpiryWorkflow({ userId: "u1" });

    expect(result).toMatchObject({ skipped: false, sent: true, threshold: 3 });
    expect(sentSubject()).toMatch(/^⚠️ Your Pro subscription ends in 3 days/);
    expect(mocks.setLastExpiryNotification).toHaveBeenCalledWith("u1", 3);
  });

  it("uses the singular for the 1-day reminder", async () => {
    mocks.getUserWithEndingSubscription.mockResolvedValue(user(new Date(NOW.getTime() + DAY), 3));

    const result = await subscriptionExpiryWorkflow({ userId: "u1" });

    expect(result).toMatchObject({ skipped: false, sent: true, threshold: 1 });
    expect(sentSubject()).toContain("in 1 day");
    expect(sentSubject()).not.toContain("1 days");
  });

  it("says 'within 24 hours' instead of '0 days' when under a day is left", async () => {
    mocks.getUserWithEndingSubscription.mockResolvedValue(
      user(new Date(NOW.getTime() + 12 * HOUR), 3),
    );

    const result = await subscriptionExpiryWorkflow({ userId: "u1" });

    expect(result).toMatchObject({ skipped: false, sent: true, threshold: 1 });
    expect(sentSubject()).toContain("within 24 hours");
    expect(sentSubject()).not.toContain("0 day");
  });

  it("skips a threshold that was already sent", async () => {
    mocks.getUserWithEndingSubscription.mockResolvedValue(
      user(new Date(NOW.getTime() + 3 * DAY), 3),
    );

    const result = await subscriptionExpiryWorkflow({ userId: "u1" });

    expect(result).toMatchObject({ skipped: true, reason: "already_sent", lastSent: 3 });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.setLastExpiryNotification).not.toHaveBeenCalled();
  });

  it("skips a subscription that has already ended", async () => {
    mocks.getUserWithEndingSubscription.mockResolvedValue(
      user(new Date(NOW.getTime() - HOUR), null),
    );

    const result = await subscriptionExpiryWorkflow({ userId: "u1" });

    expect(result).toMatchObject({ skipped: true, reason: "out_of_range" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("skips when the user has no ending subscription", async () => {
    mocks.getUserWithEndingSubscription.mockResolvedValue(null);

    const result = await subscriptionExpiryWorkflow({ userId: "u1" });

    expect(result).toEqual({ skipped: true, reason: "not_found" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
