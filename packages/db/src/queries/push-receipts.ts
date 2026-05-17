import { and, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { db } from "../client";
import { pushReceipts } from "../schema";

const RECEIPT_BATCH_LIMIT = 1000;
const RECEIPT_MIN_AGE_MS = 5 * 60 * 1000;
const RECEIPT_EXPIRY_MS = 23 * 60 * 60 * 1000;

export interface PendingReceiptInput {
  ticketId: string;
  expoPushToken: string;
  userId: string;
  notificationId?: string | null;
}

export interface PendingReceiptRow {
  id: string;
  ticketId: string;
  expoPushToken: string;
  notificationId: string | null;
  userId: string;
  createdAt: Date;
}

export interface ReceiptProcessingUpdate {
  ticketId: string;
  errorCode: string | null;
}

/**
 * Tokens that already have a receipt row for this notification. Used as the
 * idempotency key for the push send step: on a durable retry, any device that
 * already received a ticket is skipped so the user isn't pushed twice. Devices
 * that errored without a ticket have no receipt and are correctly retried.
 */
export async function getDispatchedTokensForNotification(
  notificationId: string,
): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ expoPushToken: pushReceipts.expoPushToken })
    .from(pushReceipts)
    .where(eq(pushReceipts.notificationId, notificationId));
  return new Set(rows.map((row) => row.expoPushToken));
}

export async function insertPendingReceipts(rows: PendingReceiptInput[]) {
  if (rows.length === 0) return;
  await db
    .insert(pushReceipts)
    .values(
      rows.map((row) => ({
        ticketId: row.ticketId,
        expoPushToken: row.expoPushToken,
        userId: row.userId,
        notificationId: row.notificationId ?? null,
      })),
    )
    .onConflictDoNothing({ target: pushReceipts.ticketId });
}

/**
 * Record a dispatch marker for a device that received a status-ok Expo
 * response *without* a ticket id (rare). No Expo receipt can ever be polled
 * for it, so the row is written pre-processed (`processedAt` set): the receipt
 * poller (`getPendingReceiptsBatch`) and `expireStaleReceipts` skip it, while
 * `deleteOldProcessedReceipts` still GCs it. Its sole purpose is cross-run
 * idempotency — `getDispatchedTokensForNotification` keys on `notificationId`
 * regardless of `processedAt`, so a durable retry skips the device. The
 * synthetic `ticketId` must be deterministic so retries collide on the unique
 * constraint.
 */
export async function insertDispatchedMarkers(rows: PendingReceiptInput[]) {
  if (rows.length === 0) return;
  const now = new Date();
  await db
    .insert(pushReceipts)
    .values(
      rows.map((row) => ({
        ticketId: row.ticketId,
        expoPushToken: row.expoPushToken,
        userId: row.userId,
        notificationId: row.notificationId ?? null,
        processedAt: now,
        errorCode: "NoTicketId",
      })),
    )
    .onConflictDoNothing({ target: pushReceipts.ticketId });
}

export async function getPendingReceiptsBatch(): Promise<PendingReceiptRow[]> {
  const minAge = new Date(Date.now() - RECEIPT_MIN_AGE_MS);
  return await db
    .select({
      id: pushReceipts.id,
      ticketId: pushReceipts.ticketId,
      expoPushToken: pushReceipts.expoPushToken,
      notificationId: pushReceipts.notificationId,
      userId: pushReceipts.userId,
      createdAt: pushReceipts.createdAt,
    })
    .from(pushReceipts)
    .where(and(isNull(pushReceipts.processedAt), lt(pushReceipts.createdAt, minAge)))
    .orderBy(pushReceipts.createdAt)
    .limit(RECEIPT_BATCH_LIMIT);
}

export async function markReceiptsProcessed(updates: ReceiptProcessingUpdate[]) {
  if (updates.length === 0) return;

  const now = new Date();
  const ticketIdsToErrorCode = new Map(updates.map((u) => [u.ticketId, u.errorCode]));
  const ticketIds = Array.from(ticketIdsToErrorCode.keys());

  const errorCases = updates
    .filter((u) => u.errorCode !== null)
    .map((u) => sql`when ${pushReceipts.ticketId} = ${u.ticketId} then ${u.errorCode}`);

  const errorExpression =
    errorCases.length > 0
      ? sql.join([sql`case`, ...errorCases, sql`else null end`], sql` `)
      : sql`null`;

  await db
    .update(pushReceipts)
    .set({ processedAt: now, errorCode: errorExpression })
    .where(and(inArray(pushReceipts.ticketId, ticketIds), isNull(pushReceipts.processedAt)));
}

export async function expireStaleReceipts(): Promise<number> {
  const cutoff = new Date(Date.now() - RECEIPT_EXPIRY_MS);
  const expired = await db
    .update(pushReceipts)
    .set({ processedAt: new Date(), errorCode: "ReceiptExpired" })
    .where(and(isNull(pushReceipts.processedAt), lt(pushReceipts.createdAt, cutoff)))
    .returning({ id: pushReceipts.id });
  return expired.length;
}

export async function deleteOldProcessedReceipts(olderThanMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const deleted = await db
    .delete(pushReceipts)
    .where(and(isNotNull(pushReceipts.processedAt), lt(pushReceipts.processedAt, cutoff)))
    .returning({ id: pushReceipts.id });
  return deleted.length;
}
