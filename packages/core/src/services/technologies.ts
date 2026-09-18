/**
 * Technologies service - fetches the homepage, derives a detection context,
 * runs the technology catalog matcher, and persists the result.
 *
 * Transient errors throw (for TanStack Query to retry). A missing/unavailable
 * technology catalog is not an error - it produces an empty detection list,
 * matching how `fetchHosting` treats a missing provider catalog.
 */

import * as cheerio from "cheerio";

import { getTechnologyCatalog } from "@domainstack/catalog";
import { detectTechnologies } from "@domainstack/catalog/technologies";
import type { TechDetectionContext } from "@domainstack/catalog/technologies";
import { ensureDomainRecord } from "@domainstack/db/queries/domains";
import { upsertTechnologies } from "@domainstack/db/queries/technologies";
import type { DetectedTechnology, TechnologiesResponse } from "@domainstack/types";
import { parseSetCookieHeaders } from "@domainstack/utils/cookies";

import { ttlForTechnologies } from "../ttl";
import { fetchDns } from "./dns";
import type { HtmlDocument } from "./html-document";
import { fetchHtmlDocument } from "./html-document";

// ============================================================================
// Types
// ============================================================================

export type TechnologiesError = "dns_error" | "tls_error";

export type TechnologiesResult =
  | { success: true; data: TechnologiesResponse }
  | { success: false; error: TechnologiesError };

// ============================================================================
// Main Service Function
// ============================================================================

/**
 * Fetch and persist detected technologies for a domain.
 *
 * @param domain - The domain to analyze
 * @returns Technologies result with data or error
 *
 * @throws Error on transient failures (network issues) - TanStack Query retries these
 */
export async function fetchTechnologies(domain: string): Promise<TechnologiesResult> {
  // Fetch the page (shared with SEO), DNS (enrichment only), and the
  // technology catalog in parallel.
  const [doc, dnsResult, catalog] = await Promise.all([
    fetchHtmlDocument(domain),
    fetchDns(domain).catch(() => null),
    getTechnologyCatalog(),
  ]);

  // Permanent HTML failures that mean nothing could be analyzed at all.
  if (doc.error === "DNS resolution failed" || doc.error === "Invalid SSL certificate") {
    const response: TechnologiesResponse = {
      technologies: [],
      source: { finalUrl: doc.finalUrl, status: doc.status },
      error: doc.error,
    };
    await persistTechnologies(domain, response);
    return {
      success: false,
      error: doc.error === "DNS resolution failed" ? "dns_error" : "tls_error",
    };
  }

  // A null catalog is a normal degraded state (Edge Config unconfigured,
  // missing key, or invalid value) - skip detection, persist an empty row.
  if (!catalog) {
    const response: TechnologiesResponse = {
      technologies: [],
      source: { finalUrl: doc.finalUrl, status: doc.status },
      ...(doc.error ? { error: doc.error } : {}),
    };
    await persistTechnologies(domain, response);
    return { success: true, data: response };
  }

  const dnsTxt = dnsResult?.data.records.filter((r) => r.type === "TXT").map((r) => r.value) ?? [];

  const ctx = buildDetectionContext(doc, dnsTxt);
  const detected: DetectedTechnology[] = detectTechnologies(catalog, ctx);

  const response: TechnologiesResponse = {
    technologies: detected,
    source: { finalUrl: doc.finalUrl, status: doc.status },
    ...(doc.error ? { error: doc.error } : {}),
  };

  await persistTechnologies(domain, response);

  return { success: true, data: response };
}

// ============================================================================
// Internal: Build detection context
// ============================================================================

function buildDetectionContext(doc: HtmlDocument, dnsTxt: string[]): TechDetectionContext {
  const html = doc.html ?? "";
  const $ = cheerio.load(html);

  const meta: Record<string, string[]> = {};
  $("meta").each((_i, el) => {
    const attribs = el.attribs ?? {};
    const key = (attribs.name ?? attribs.property ?? attribs["http-equiv"])?.toLowerCase();
    if (!key) return;
    const content = attribs.content ?? "";
    (meta[key] ??= []).push(content);
  });

  const scriptSrcSet = new Set<string>();
  $("script[src]").each((_i, el) => {
    const src = el.attribs?.src;
    if (!src) return;
    try {
      scriptSrcSet.add(new URL(src, doc.finalUrl).toString());
    } catch {
      scriptSrcSet.add(src);
    }
  });

  return {
    url: doc.finalUrl,
    html,
    headers: doc.headers,
    cookies: parseSetCookieHeaders(doc.setCookie),
    meta,
    scriptSrc: [...scriptSrcSet],
    dnsTxt,
  };
}

// ============================================================================
// Internal: Persist Technologies
// ============================================================================

async function persistTechnologies(domain: string, response: TechnologiesResponse): Promise<void> {
  const now = new Date();
  const expiresAt = ttlForTechnologies(now);

  const domainRecord = await ensureDomainRecord(domain);

  await upsertTechnologies({
    domainId: domainRecord.id,
    detected: response.technologies,
    sourceFinalUrl: response.source.finalUrl,
    sourceStatus: response.source.status,
    error: response.error ?? null,
    fetchedAt: now,
    expiresAt,
  });
}
