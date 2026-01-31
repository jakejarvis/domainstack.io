/**
 * DNS-over-HTTPS (DoH) query utilities.
 *
 * Uses plain Node.js fetch with AbortController for timeout.
 */

import { DOH_PROVIDERS, type DohProvider } from "@domainstack/constants";
import { simpleHash } from "@domainstack/utils";
import type { DnsAnswer, DnsJson, DohQueryOptions } from "./types";

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Build a DoH query URL for a given provider, domain, and record type.
 */
function buildDohUrl(provider: DohProvider, domain: string, type: string): URL {
  const url = new URL(provider.url);
  url.searchParams.set("name", domain);
  url.searchParams.set("type", type);
  return url;
}

/**
 * Deterministic provider ordering based on domain hash for cache consistency.
 * Ensures the same domain always tries providers in the same order across requests.
 */
export function providerOrderForLookup(domain: string): DohProvider[] {
  // Normalize to lowercase for case-insensitive DNS name matching (RFC 1035)
  const hash = simpleHash(domain.toLowerCase());
  const start = hash % DOH_PROVIDERS.length;
  return [
    ...DOH_PROVIDERS.slice(start),
    ...DOH_PROVIDERS.slice(0, start),
  ] as DohProvider[];
}

/**
 * Query a single record type from a DoH provider.
 * Returns parsed DNS answers or empty array if no records found.
 *
 * This is the shared primitive used by both:
 * - Full DNS lookups
 * - SSRF protection IP resolution
 */
export async function queryDohProvider(
  provider: DohProvider,
  domain: string,
  type: string,
  options: DohQueryOptions = {},
): Promise<DnsAnswer[]> {
  const url = buildDohUrl(provider, domain, type);
  if (options.cacheBust) {
    url.searchParams.set("t", Date.now().toString());
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  const res = await fetch(url, {
    headers: {
      Accept: "application/dns-json",
    },
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!res.ok) {
    throw new Error(`DoH query failed: ${provider.key} ${type} ${res.status}`);
  }

  const json = (await res.json()) as DnsJson;

  // Validate JSON shape to prevent crashes on unexpected provider responses
  if (!json || typeof json !== "object") {
    throw new Error(`DoH invalid response: ${provider.key} (not an object)`);
  }

  // NXDOMAIN or no answers
  if (json.Status !== 0 || !json.Answer) {
    return [];
  }

  if (!Array.isArray(json.Answer)) {
    throw new Error(
      `DoH invalid response: ${provider.key} (Answer is not an array)`,
    );
  }

  return json.Answer;
}

/**
 * Filter DNS answers to only those matching the expected type number.
 * DoH providers often include CNAME records in answer chains.
 */
export function filterAnswersByType(
  answers: DnsAnswer[],
  expectedType: number,
): DnsAnswer[] {
  return answers.filter((a) => a.type === expectedType);
}
