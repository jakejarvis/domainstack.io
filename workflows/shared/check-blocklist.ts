/**
 * Shared step for checking if a domain is on the blocklist.
 * Used by screenshot and SEO workflows.
 */
export async function checkBlocklist(
  domain: string,
  source: string,
): Promise<boolean> {
  "use step";

  const { isDomainBlocked } = await import("@/lib/db/repos/blocked-domains");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source });

  const blocked = await isDomainBlocked(domain);
  if (blocked) {
    logger.info({ domain }, "blocked by blocklist");
  }
  return blocked;
}
