import type { Certificate, RegistrationResponse } from "@domainstack/types";

import { optionalCall, optionalSettled, requireSettled } from "../lib/settled";
import {
  fetchCertificateChainStep,
  persistCertificatesStep,
  processChainStep,
} from "./certificates";
import { fetchDnsRecordsStep, persistDnsRecordsStep } from "./dns";
import { fetchHeadersStep, persistHeadersStep } from "./headers";
import { detectAndResolveProvidersStep, lookupGeoIpStep, persistHostingStep } from "./hosting";
import {
  lookupWhoisStep,
  normalizeAndBuildResponseStep,
  persistRegistrationStep,
} from "./registration";

/**
 * Fetches fresh registration, DNS, headers, certificate, and hosting data for a
 * domain and persists it to the cache. Called inline from workflow functions.
 *
 * DNS is required. WHOIS/headers/certs are enrichment: RDAP timeouts and
 * unreachable HTTP/TLS hosts (or a domain with no A/AAAA) must not fail the run.
 */
export async function observeDomain(domainName: string) {
  const [registrationSettled, dnsSettled, headersSettled, certificatesSettled] =
    await Promise.allSettled([
      lookupWhoisStep(domainName),
      fetchDnsRecordsStep(domainName),
      fetchHeadersStep(domainName),
      fetchCertificateChainStep(domainName),
    ]);

  const registrationResult = optionalSettled(registrationSettled);
  const dnsResult = requireSettled(dnsSettled);
  const headersResult = optionalSettled(headersSettled);
  const certificatesResult = optionalSettled(certificatesSettled);

  // Process and persist registration
  let registrationData: RegistrationResponse | null = null;
  if (registrationResult?.success) {
    registrationData = await normalizeAndBuildResponseStep(registrationResult.data.recordJson);
    // Persist registered and unregistered alike, so a drop updates the cache
    await optionalCall(persistRegistrationStep(domainName, registrationData));
  }

  // The DNS cache is a side effect here: callers use dnsResult directly, so a
  // failed write must not abort the run (same rule as the other persists).
  await optionalCall(persistDnsRecordsStep(domainName, dnsResult));

  if (headersResult?.success) {
    await optionalCall(persistHeadersStep(domainName, headersResult.data));
  }

  // Process and persist certificates
  let certificates: Certificate[] = [];
  if (certificatesResult?.success) {
    const processed = await optionalCall(processChainStep(certificatesResult));
    if (processed) {
      await optionalCall(persistCertificatesStep(domainName, processed));
      certificates = processed.certificates;
    }
  }

  // Hosting detection uses DNS even when headers fail (no A/AAAA, etc.)
  const a = dnsResult.records.find((d) => d.type === "A");
  const aaaa = dnsResult.records.find((d) => d.type === "AAAA");
  const ip = (a?.value || aaaa?.value) ?? null;
  const geoResult = ip ? await optionalCall(lookupGeoIpStep(ip)) : null;
  const headers = headersResult?.success ? headersResult.data.headers : [];

  const providers = await detectAndResolveProvidersStep(dnsResult.records, headers, geoResult);

  await optionalCall(persistHostingStep(domainName, providers, geoResult?.geo ?? null));

  return { registrationData, dnsResult, headersResult, certificates, ip, geoResult, providers };
}
