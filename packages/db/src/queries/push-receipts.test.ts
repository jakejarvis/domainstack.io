import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { pushReceipts, users } from "../schema";
import { closePGliteDb, makePGliteDb } from "../testing";
import {
  deleteOldProcessedReceipts,
  expireStaleReceipts,
  getPendingReceiptsBatch,
  insertPendingReceipts,
  markReceiptsProcessed,
} from "./index";

const TEST_USER_ID = "receipt-test-user";
let testDb: Awaited<ReturnType<typeof makePGliteDb>>["db"];

describe("push receipts queries", () => {
  beforeAll(async () => {
    const bundle = await makePGliteDb();
    testDb = bundle.db;
  });

  beforeEach(async () => {
    await testDb.delete(pushReceipts);
    await testDb.delete(users);
    await testDb.insert(users).values({
      email: "receipt@example.com",
      id: TEST_USER_ID,
      name: "Receipt Tester",
    });
  });

  afterAll(async () => {
    await closePGliteDb();
  });

  it("inserts pending receipts and skips duplicate ticket IDs", async () => {
    await insertPendingReceipts([
      {
        expoPushToken: "ExponentPushToken[a]",
        notificationId: null,
        ticketId: "ticket-1",
        userId: TEST_USER_ID,
      },
      {
        expoPushToken: "ExponentPushToken[a]",
        notificationId: null,
        ticketId: "ticket-1",
        userId: TEST_USER_ID,
      },
    ]);

    const rows = await testDb.select().from(pushReceipts);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.ticketId).toBe("ticket-1");
    expect(rows[0]?.processedAt).toBeNull();
  });

  it("only returns pending receipts older than the minimum age", async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    await testDb.insert(pushReceipts).values([
      {
        createdAt: tenMinutesAgo,
        expoPushToken: "ExponentPushToken[old]",
        ticketId: "ticket-old",
        userId: TEST_USER_ID,
      },
      {
        createdAt: oneMinuteAgo,
        expoPushToken: "ExponentPushToken[new]",
        ticketId: "ticket-new",
        userId: TEST_USER_ID,
      },
    ]);

    const batch = await getPendingReceiptsBatch();
    expect(batch.map((row) => row.ticketId)).toEqual(["ticket-old"]);
  });

  it("marks receipts processed with mixed success and error codes", async () => {
    await insertPendingReceipts([
      {
        expoPushToken: "ExponentPushToken[a]",
        notificationId: null,
        ticketId: "ticket-ok",
        userId: TEST_USER_ID,
      },
      {
        expoPushToken: "ExponentPushToken[b]",
        notificationId: null,
        ticketId: "ticket-bad",
        userId: TEST_USER_ID,
      },
    ]);

    await markReceiptsProcessed([
      { errorCode: null, ticketId: "ticket-ok" },
      { errorCode: "DeviceNotRegistered", ticketId: "ticket-bad" },
    ]);

    const rows = await testDb.select().from(pushReceipts).orderBy(pushReceipts.ticketId);
    const byTicketId = new Map(rows.map((row) => [row.ticketId, row]));
    expect(byTicketId.get("ticket-ok")?.processedAt).not.toBeNull();
    expect(byTicketId.get("ticket-ok")?.errorCode).toBeNull();
    expect(byTicketId.get("ticket-bad")?.processedAt).not.toBeNull();
    expect(byTicketId.get("ticket-bad")?.errorCode).toBe("DeviceNotRegistered");
  });

  it("expires receipts older than 23h that never matured", async () => {
    const oneDayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const recent = new Date(Date.now() - 10 * 60 * 1000);

    await testDb.insert(pushReceipts).values([
      {
        createdAt: oneDayAgo,
        expoPushToken: "ExponentPushToken[a]",
        ticketId: "ticket-stale",
        userId: TEST_USER_ID,
      },
      {
        createdAt: recent,
        expoPushToken: "ExponentPushToken[b]",
        ticketId: "ticket-fresh",
        userId: TEST_USER_ID,
      },
    ]);

    const expired = await expireStaleReceipts();
    expect(expired).toBe(1);

    const rows = await testDb.select().from(pushReceipts).orderBy(pushReceipts.ticketId);
    const byTicketId = new Map(rows.map((row) => [row.ticketId, row]));
    expect(byTicketId.get("ticket-stale")?.errorCode).toBe("ReceiptExpired");
    expect(byTicketId.get("ticket-stale")?.processedAt).not.toBeNull();
    expect(byTicketId.get("ticket-fresh")?.processedAt).toBeNull();
  });

  it("deletes processed receipts older than the retention window", async () => {
    const longAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const recent = new Date();

    await testDb.insert(pushReceipts).values([
      {
        createdAt: longAgo,
        expoPushToken: "ExponentPushToken[old]",
        processedAt: longAgo,
        ticketId: "ticket-old-processed",
        userId: TEST_USER_ID,
      },
      {
        createdAt: recent,
        expoPushToken: "ExponentPushToken[fresh]",
        processedAt: recent,
        ticketId: "ticket-recent-processed",
        userId: TEST_USER_ID,
      },
      {
        createdAt: longAgo,
        expoPushToken: "ExponentPushToken[unprocessed]",
        ticketId: "ticket-old-pending",
        userId: TEST_USER_ID,
      },
    ]);

    const deleted = await deleteOldProcessedReceipts(7 * 24 * 60 * 60 * 1000);
    expect(deleted).toBe(1);

    const remaining = await testDb.select().from(pushReceipts);
    expect(remaining.map((row) => row.ticketId).sort()).toEqual([
      "ticket-old-pending",
      "ticket-recent-processed",
    ]);
  });
});
