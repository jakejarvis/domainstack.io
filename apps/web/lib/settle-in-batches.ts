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
