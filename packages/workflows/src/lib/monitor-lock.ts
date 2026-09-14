import { getRedis } from "@domainstack/redis";

/**
 * Per-`trackedDomainId` start-dedup for the hourly `monitor-domains` cron.
 *
 * The cron only *starts* `detectChangesWorkflow`; it does not await it. Without
 * a guard, an in-flight run still retrying on slow WHOIS / rate-limit backoff
 * when the next hourly cron fires gets a *second* concurrent run started for
 * the same domain — both read the stale snapshot and both notify.
 *
 * The lock is acquired by the cron and released by the workflow on successful
 * completion. The TTL (> the 60-minute cron interval) is only the crash safety
 * net: a healthy run frees the lock immediately, an in-flight/retrying run
 * keeps it held past the next hourly tick (no duplicate), and a dead run
 * self-heals after the TTL.
 *
 * Fails open: if Redis is unconfigured/unreachable we proceed without dedup
 * (matching the prior no-dedup behavior) rather than halting monitoring.
 */
const LOCK_TTL_SECONDS = 90 * 60;
const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

function lockKey(trackedDomainId: string): string {
  return `monitor:detect-changes:${trackedDomainId}`;
}

export async function acquireMonitorLock(trackedDomainId: string): Promise<string | null> {
  const ownerToken = crypto.randomUUID();
  const redis = getRedis();
  if (!redis) return ownerToken; // fail open — don't block monitoring

  try {
    const result = await redis.set(lockKey(trackedDomainId), ownerToken, {
      nx: true,
      ex: LOCK_TTL_SECONDS,
    });
    return result === "OK" ? ownerToken : null;
  } catch {
    return ownerToken; // fail open on Redis error
  }
}

export async function releaseMonitorLock(
  trackedDomainId: string,
  ownerToken: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.eval(RELEASE_LOCK_SCRIPT, [lockKey(trackedDomainId)], [ownerToken]);
  } catch {
    // Best-effort: the TTL will free the lock if the delete fails.
  }
}
