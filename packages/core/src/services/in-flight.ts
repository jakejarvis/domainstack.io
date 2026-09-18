import { LRUCache } from "lru-cache";

/**
 * Share one in-flight promise per key within this process.
 *
 * A second caller that arrives while `run` is still pending receives the same
 * promise instead of starting duplicate work. The entry is removed as soon as
 * the promise settles, so later calls always run fresh. This deduplicates
 * concurrent work only; it is not a cache.
 */
const inFlight = new LRUCache<string, Promise<unknown>>({ max: 1000 });

export function shareInFlight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = Promise.resolve()
    .then(run)
    .finally(() => {
      if (inFlight.get(key) === promise) {
        inFlight.delete(key);
      }
    });
  inFlight.set(key, promise);
  return promise;
}
