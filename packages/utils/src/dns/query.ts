/**
 * DNS-over-HTTPS (DoH) query utilities.
 *
 * Uses plain Node.js fetch with AbortController for timeout.
 */

import { DOH_PROVIDERS } from "@domainstack/constants";
import type { DohProvider } from "@domainstack/types";

import { simpleHash } from "../simple-hash";
import type { DnsAnswer, DnsJson, DohQueryOptions } from "./types";

const DEFAULT_TIMEOUT_MS = 5000;

/** DoH JSON answers are small; anything larger is a misbehaving provider. */
const MAX_RESPONSE_BYTES = 1024 * 1024;

/** DNS RCODE 3 — the name does not exist. A legitimate empty result. */
const RCODE_NXDOMAIN = 3;

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
  return [...DOH_PROVIDERS.slice(start), ...DOH_PROVIDERS.slice(0, start)] as DohProvider[];
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

  // AbortSignal.timeout stays armed through the body read. A manually cleared
  // timer stops covering the response the moment the headers arrive, so a
  // provider that stalls mid-body would hang the query indefinitely.
  const res = await fetch(url, {
    headers: {
      Accept: "application/dns-json",
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`DoH query failed: ${provider.key} ${type} ${res.status}`);
  }

  const declaredLength = Number(res.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error(`DoH response too large: ${provider.key} ${type} ${declaredLength} bytes`);
  }

  const json = (await res.json()) as DnsJson;

  // Validate JSON shape to prevent crashes on unexpected provider responses
  if (!json || typeof json !== "object") {
    throw new Error(`DoH invalid response: ${provider.key} (not an object)`);
  }

  // NXDOMAIN means the name genuinely has no records — a successful empty result.
  if (json.Status === RCODE_NXDOMAIN) {
    return [];
  }

  // Any other non-zero RCODE (SERVFAIL, REFUSED, …) is a resolver failure, not
  // an answer. It must throw so callers fall back to the next DoH provider —
  // returning [] here would be indistinguishable from "this domain has no
  // records" and has caused false "provider removed" notifications.
  if (json.Status !== 0) {
    throw new Error(`DoH query failed: ${provider.key} ${type} rcode=${json.Status}`);
  }

  // NOERROR with no answer section: the name exists but has no records of this type.
  if (!json.Answer) {
    return [];
  }

  if (!Array.isArray(json.Answer)) {
    throw new Error(`DoH invalid response: ${provider.key} (Answer is not an array)`);
  }

  return json.Answer;
}
