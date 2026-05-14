import { and, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";

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
