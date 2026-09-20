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

/**
 * `settleInBatches` for workflow starts: returns how many succeeded and logs a
 * single warning if any failed.
 *
 * One representative error is enough to diagnose a systemic failure (auth, rate
 * limit, outage) without logging thousands of entries.
 */
export async function startInBatches<T>(
  items: readonly T[],
  batchSize: number,
  fn: (item: T) => Promise<unknown>,
  logger: { warn: (obj: object, msg: string) => void },
): Promise<number> {
  const results = await settleInBatches(items, batchSize, fn);
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failures.length > 0) {
    logger.warn(
      { failed: failures.length, total: items.length, err: failures[0].reason },
      "Some workflow starts failed",
    );
  }
  return results.length - failures.length;
}
