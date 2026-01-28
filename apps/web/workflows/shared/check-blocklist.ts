/**
 * Shared step for checking if a domain is on the blocklist.
 * Used by screenshot and SEO workflows.
 */
export async function checkBlocklist(domain: string): Promise<boolean> {
  "use step";

  const { blockedDomainsRepo } = await import("@/lib/db/repos");

  const blocked = await blockedDomainsRepo.isDomainBlocked(domain);
  return blocked;
}
