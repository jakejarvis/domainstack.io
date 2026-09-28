/**
 * Run `fn` over `items` with at most `batchSize` calls in flight, returning
 * settled results in input order.
 *
 * Cron routes fan out one outbound call (workflow start, Redis lock) per tracked
 * domain; launching them all at once exhausts sockets and upstream rate limits
 * as the domain count grows.
 */
export async function settleInBatches<T, R>(
  items: readonly T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    results.push(...(await Promise.allSettled(items.slice(i, i + batchSize).map(fn))));
  }
  return results;
}

/** Outcome of a batched workflow dispatch. */
export interface StartBatchResult {
  started: number;
  failed: number;
}

/**
 * `settleInBatches` for workflow starts: attempts every item, returns how many
 * started and how many failed, and logs a single warning if any failed.
 *
 * Callers decide how to surface `failed` (cron routes return HTTP 500) so a
 * partial dispatch is visible to the scheduler while successful starts remain.
 * One representative error is enough to diagnose a systemic failure (auth, rate
 * limit, outage) without logging thousands of entries.
 */
export async function startInBatches<T>(
  items: readonly T[],
  batchSize: number,
  fn: (item: T) => Promise<unknown>,
  logger: { warn: (obj: object, msg: string) => void },
): Promise<StartBatchResult> {
  const results = await settleInBatches(items, batchSize, fn);
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failures.length > 0) {
    logger.warn(
      { failed: failures.length, total: items.length, err: failures[0].reason },
      "Some workflow starts failed",
    );
  }
  return { started: results.length - failures.length, failed: failures.length };
}
