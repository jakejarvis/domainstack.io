export interface SyncBlocklistWorkflowInput {
  // No input needed, sources come from Edge Config
}

export interface SyncBlocklistWorkflowResult {
  sources: number;
  added: number;
  removed: number;
  total: number;
}

/**
 * Durable workflow to sync the screenshot blocklist from external sources.
 *
 * Fetches blocklist URLs from Edge Config, downloads each list,
 * parses domains, and syncs to the blocked_domains table.
 */
export async function syncBlocklistWorkflow(
  _input: SyncBlocklistWorkflowInput = {},
): Promise<SyncBlocklistWorkflowResult> {
  "use workflow";

  // Step 1: Fetch blocklist source URLs from Edge Config
  const sources = await fetchBlocklistSources();

  if (sources.length === 0) {
    return {
      sources: 0,
      added: 0,
      removed: 0,
      total: 0,
    };
  }

  // Step 2: Fetch and parse all blocklists
  const allDomains: string[] = [];

  for (let index = 0; index < sources.length; index++) {
    const sourceUrl = sources[index];
    const domains = await fetchAndParseBlocklist(index, sourceUrl);
    allDomains.push(...domains);
  }

  // Step 3: Deduplicate and sync to database
  const uniqueDomains = [...new Set(allDomains)];
  const result = await syncToDatabase(uniqueDomains);

  return {
    sources: sources.length,
    added: result.added,
    removed: result.removed,
    total: result.total,
  };
}

async function fetchBlocklistSources(): Promise<string[]> {
  "use step";

  const { getBlocklistSources } = await import("@/lib/edge-config");
  return await getBlocklistSources();
}

async function fetchAndParseBlocklist(
  _index: number,
  sourceUrl: string,
): Promise<string[]> {
  "use step";

  const { fetchWithTimeoutAndRetry } = await import("@/lib/fetch");
  const { createLogger } = await import("@/lib/logger/server");

  const logger = createLogger({ source: "sync-blocklist-workflow" });

  try {
    const response = await fetchWithTimeoutAndRetry(
      sourceUrl,
      {},
      { timeoutMs: 30_000, retries: 2 },
    );

    if (!response.ok) {
      logger.warn(
        { sourceUrl, status: response.status },
        "Failed to fetch blocklist",
      );
      return [];
    }

    const text = await response.text();
    const lines = text.split("\n");

    // Parse domains from blocklist format
    // OISD uses wildcard format: *.example.com or example.com
    const parsed: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) continue;

      // Strip wildcard prefix if present (*.example.com -> example.com)
      const domain = trimmed.startsWith("*.") ? trimmed.slice(2) : trimmed;

      // Basic domain validation
      if (
        domain?.includes(".") &&
        !domain.includes(" ") &&
        domain.length <= 253 &&
        !domain.startsWith(".") &&
        !domain.endsWith(".")
      ) {
        parsed.push(domain.toLowerCase());
      }
    }

    logger.info({ sourceUrl, count: parsed.length }, "Parsed domains from blocklist");
    return parsed;
  } catch (err) {
    logger.error(
      { err, sourceUrl },
      "Error fetching blocklist",
    );
    return [];
  }
}

async function syncToDatabase(
  domains: string[],
): Promise<{ added: number; removed: number; total: number }> {
  "use step";

  const { syncBlockedDomains } = await import("@/lib/db/repos/blocked-domains");
  return await syncBlockedDomains(domains);
}
