import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserIdsPastDue: vi.fn<() => Promise<string[]>>(),
  getUserIdsWithEndingSubscriptions: vi.fn<() => Promise<string[]>>(),
  start: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock("workflow/api", () => ({ start: mocks.start }));
vi.mock("@domainstack/workflows/subscription-expiry", () => ({
  subscriptionExpiryWorkflow: vi.fn<(input: unknown) => Promise<unknown>>(),
}));
vi.mock("@domainstack/workflows/subscription-downgrade", () => ({
  subscriptionDowngradeWorkflow: vi.fn<(input: unknown) => Promise<unknown>>(),
}));
vi.mock("@domainstack/db/queries/user-subscription", () => ({
  getUserIdsPastDue: mocks.getUserIdsPastDue,
  getUserIdsWithEndingSubscriptions: mocks.getUserIdsWithEndingSubscriptions,
}));

import { GET } from "@/app/api/cron/check-subscription-expiry/route";
import { subscriptionDowngradeWorkflow } from "@domainstack/workflows/subscription-downgrade";
import { subscriptionExpiryWorkflow } from "@domainstack/workflows/subscription-expiry";

const authorized = () =>
  new Request("https://domainstack.io/api/cron/check-subscription-expiry", {
    headers: { Authorization: "Bearer test-secret" },
  });

describe("check subscription expiry cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-secret");
    mocks.getUserIdsWithEndingSubscriptions.mockResolvedValue([]);
    mocks.getUserIdsPastDue.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 and performs no query or start without valid authorization", async () => {
    const response = await GET(
      new Request("https://domainstack.io/api/cron/check-subscription-expiry"),
    );

    expect(response.status).toBe(401);
    expect(mocks.getUserIdsWithEndingSubscriptions).not.toHaveBeenCalled();
    expect(mocks.getUserIdsPastDue).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("starts one reminder and one downgrade workflow per user and returns 200", async () => {
    mocks.getUserIdsWithEndingSubscriptions.mockResolvedValue(["u-1", "u-2"]);
    mocks.getUserIdsPastDue.mockResolvedValue(["u-3"]);
    mocks.start.mockResolvedValue(undefined);

    const response = await GET(authorized());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      remindersStarted: 2,
      remindersFailed: 0,
      downgradesStarted: 1,
      downgradesFailed: 0,
    });
    expect(mocks.start).toHaveBeenCalledTimes(3);
    expect(mocks.start).toHaveBeenCalledWith(subscriptionExpiryWorkflow, [{ userId: "u-1" }]);
    expect(mocks.start).toHaveBeenCalledWith(subscriptionExpiryWorkflow, [{ userId: "u-2" }]);
    expect(mocks.start).toHaveBeenCalledWith(subscriptionDowngradeWorkflow, [{ userId: "u-3" }]);
  });

  it("returns 500 when reminders partially fail but still attempts every downgrade", async () => {
    mocks.getUserIdsWithEndingSubscriptions.mockResolvedValue(["u-1", "u-2"]);
    mocks.getUserIdsPastDue.mockResolvedValue(["u-3", "u-4"]);
    mocks.start.mockImplementation(async (...args: unknown[]) => {
      const [{ userId }] = args[1] as [{ userId: string }];
      if (userId === "u-2") throw new Error("Workflow API unavailable");
      return undefined;
    });

    const response = await GET(authorized());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      remindersStarted: 1,
      remindersFailed: 1,
      downgradesStarted: 2,
      downgradesFailed: 0,
    });
    expect(mocks.start).toHaveBeenCalledTimes(4);
  });

  it("returns 500 when downgrades partially fail after reminders fully start", async () => {
    mocks.getUserIdsWithEndingSubscriptions.mockResolvedValue(["u-1"]);
    mocks.getUserIdsPastDue.mockResolvedValue(["u-3", "u-4"]);
    mocks.start.mockImplementation(async (...args: unknown[]) => {
      const [{ userId }] = args[1] as [{ userId: string }];
      if (userId === "u-4") throw new Error("Workflow API unavailable");
      return undefined;
    });

    const response = await GET(authorized());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      remindersStarted: 1,
      remindersFailed: 0,
      downgradesStarted: 1,
      downgradesFailed: 1,
    });
    expect(mocks.start).toHaveBeenCalledTimes(3);
  });

  it("returns 200 with zero counts and never calls start when there is no work", async () => {
    const response = await GET(authorized());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      remindersStarted: 0,
      remindersFailed: 0,
      downgradesStarted: 0,
      downgradesFailed: 0,
    });
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
