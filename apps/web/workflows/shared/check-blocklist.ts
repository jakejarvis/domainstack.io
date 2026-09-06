/**
 * Shared step for checking if a domain is on the blocklist.
 * Used by screenshot and SEO workflows.
 */
export async function checkBlocklist(domain: string): Promise<boolean> {
  "use step";

  const { isDomainBlocked } = await import("@domainstack/db/queries/blocked-domains");

  const blocked = await isDomainBlocked(domain);
  return blocked;
}
