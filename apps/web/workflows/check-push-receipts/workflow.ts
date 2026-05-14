import { createLogger } from "@domainstack/logger";

const logger = createLogger({ source: "push-receipts" });

const MAX_BATCHES_PER_RUN = 4;
const PROCESSED_RECEIPT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

type ExpoPushReceipt = {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
};

export interface CheckPushReceiptsWorkflowResult {
  processedBatches: number;
  receiptsResolved: number;
  receiptsExpired: number;
  receiptsCleaned: number;
}

/**
 * Durable workflow that fans through pending Expo push receipts in batches of
 * up to 1000 (Expo's per-request limit) and applies their delivery status to
 * the originating push device row. Stale tokens get auto-disabled by the
 * existing `markPushDeviceSendError` query.
 */
export async function checkPushReceiptsWorkflow(): Promise<CheckPushReceiptsWorkflowResult> {
  "use workflow";

  let processedBatches = 0;
  let receiptsResolved = 0;

  for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
    const batch = await fetchPendingBatchStep();
    if (batch.length === 0) break;

    const receipts = await fetchReceiptsFromExpoStep(batch.map((row) => row.ticketId));
    const resolved = await applyReceiptsStep({ batch, receipts });

    processedBatches += 1;
    receiptsResolved += resolved;

    if (batch.length < 1000) break;
  }

  const receiptsExpired = await expireStaleReceiptsStep();
  const receiptsCleaned = await cleanupProcessedReceiptsStep();

  return { processedBatches, receiptsResolved, receiptsExpired, receiptsCleaned };
}

interface PendingReceiptRow {
  id: string;
  ticketId: string;
  expoPushToken: string;
  notificationId: string | null;
  userId: string;
  createdAt: Date;
}

async function fetchPendingBatchStep(): Promise<PendingReceiptRow[]> {
  "use step";

  const { getPendingReceiptsBatch } = await import("@domainstack/db/queries");
  return await getPendingReceiptsBatch();
}

async function fetchReceiptsFromExpoStep(
  ticketIds: string[],
): Promise<Record<string, ExpoPushReceipt>> {
  "use step";

  if (ticketIds.length === 0) return {};

  const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify({ ids: ticketIds }),
  });

  if (!response.ok) {
    logger.error({ status: response.status }, "expo receipt request failed");
    return {};
  }

  const payload = (await response.json().catch(() => null)) as {
    data?: Record<string, ExpoPushReceipt>;
  } | null;

  return payload?.data ?? {};
}

async function applyReceiptsStep(input: {
  batch: PendingReceiptRow[];
  receipts: Record<string, ExpoPushReceipt>;
}): Promise<number> {
  "use step";

  const { markPushDeviceSendError, markReceiptsProcessed } =
    await import("@domainstack/db/queries");

  const updates: Array<{ ticketId: string; errorCode: string | null }> = [];

  for (const row of input.batch) {
    const receipt = input.receipts[row.ticketId];
    if (!receipt) continue;

    if (receipt.status === "ok") {
      updates.push({ ticketId: row.ticketId, errorCode: null });
      continue;
    }

    const error = receipt.details?.error ?? receipt.message ?? "UnknownPushError";
    await markPushDeviceSendError(row.expoPushToken, error);
    updates.push({ ticketId: row.ticketId, errorCode: error });
    logger.warn(
      { error, userId: row.userId, ticketId: row.ticketId },
      "expo push receipt reported failure",
    );
  }

  await markReceiptsProcessed(updates);
  return updates.length;
}

async function expireStaleReceiptsStep(): Promise<number> {
  "use step";

  const { expireStaleReceipts } = await import("@domainstack/db/queries");
  return await expireStaleReceipts();
}

async function cleanupProcessedReceiptsStep(): Promise<number> {
  "use step";

  const { deleteOldProcessedReceipts } = await import("@domainstack/db/queries");
  return await deleteOldProcessedReceipts(PROCESSED_RECEIPT_RETENTION_MS);
}
