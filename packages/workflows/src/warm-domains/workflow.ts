import { requireSettled } from "../lib/settled";
import { selectSectionsToRefresh, type WarmSection } from "./select-sections";

interface WarmDomainWorkflowInput {
  domain: string;
}

interface WarmDomainWorkflowResult {
  refreshed: WarmSection[];
  unavailable: WarmSection[];
}

/**
 * Durable workflow that refreshes a recently viewed domain's cached report data
 * before it expires, so the next visit is served from cache. A subdomain row
 * refreshes only its hostname-scoped sections, never registration.
 *
 * Each section is its own step: unexpected failures retry, remote-unavailable
 * results are recorded and left for the next cron run. All sections settle
 * before an exhausted failure is rethrown, so one section's retries never block
 * the others.
 */
export async function warmDomainWorkflow(
  input: WarmDomainWorkflowInput,
): Promise<WarmDomainWorkflowResult> {
  "use workflow";

  const { domain } = input;
  const sections = await getSectionsToRefreshStep(domain);
  const settled = await Promise.allSettled(
    sections.map((section) => refreshSectionStep(domain, section)),
  );

  const result: WarmDomainWorkflowResult = { refreshed: [], unavailable: [] };
  settled.forEach((outcome, i) => {
    if (outcome.status === "fulfilled") {
      result[outcome.value].push(sections[i]);
    }
  });
  settled.forEach((outcome) => requireSettled(outcome));

  return result;
}

async function getSectionsToRefreshStep(domain: string): Promise<WarmSection[]> {
  "use step";

  const [
    { parseDomainTarget },
    { getCachedRegistration },
    { getCachedHosting },
    { getCachedCertificates },
    { getCachedHeaders },
    { getCachedSeo },
  ] = await Promise.all([
    import("@domainstack/utils/domain"),
    import("@domainstack/db/queries/registrations"),
    import("@domainstack/db/queries/hosting"),
    import("@domainstack/db/queries/certificates"),
    import("@domainstack/db/queries/headers"),
    import("@domainstack/db/queries/seo"),
  ]);

  // `domains` rows include hostname observations (subdomains). Registration
  // belongs to the registrable domain's own row, so only that row warms it.
  const target = parseDomainTarget(domain);
  const isRegistrable = target !== null && target.hostname === target.registrableDomain;

  try {
    const [registration, hosting, certificates, headers, seo] = await Promise.all([
      isRegistrable ? getCachedRegistration(domain) : undefined,
      getCachedHosting(domain),
      getCachedCertificates(domain),
      getCachedHeaders(domain),
      getCachedSeo(domain),
    ]);
    return selectSectionsToRefresh(
      { registration, hosting, certificates, headers, seo },
      Date.now(),
    );
  } catch (err) {
    const { classifyDatabaseError } = await import("../lib/errors");
    throw classifyDatabaseError(err, { context: `checking cache freshness for ${domain}` });
  }
}

async function refreshSectionStep(
  domain: string,
  section: WarmSection,
): Promise<"refreshed" | "unavailable"> {
  "use step";

  const { RemoteDataUnavailableError } = await import("@domainstack/core/lib/fetch-errors");
  const { fetchSection } = await import("@domainstack/core/lookup");

  try {
    const result = await fetchSection(section, domain);
    return result.success ? "refreshed" : "unavailable";
  } catch (err) {
    // The remote target couldn't supply data (unreachable host, WHOIS timeout).
    // Retrying within this run rarely helps; the next cron run tries again.
    if (err instanceof RemoteDataUnavailableError) {
      return "unavailable";
    }
    throw err;
  }
}
