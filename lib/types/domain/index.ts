/**
 * Domain types - Plain TypeScript interfaces.
 *
 * These types are for domain-related data structures.
 */

import type { CertificatesResponse } from "./certificates";
import type { DnsRecordsResponse } from "./dns";
import type { HeadersResponse } from "./headers";
import type { HostingResponse } from "./hosting";
import type { RegistrationResponse } from "./registration";
import type { SeoResponse } from "./seo";

export interface DomainResponse {
  registration: RegistrationResponse;
  dns: DnsRecordsResponse;
  hosting: HostingResponse;
  certificates: CertificatesResponse;
  headers: HeadersResponse;
  seo: SeoResponse;
}

export * from "./certificates";
export * from "./dns";
export * from "./headers";
export * from "./hosting";
export * from "./registration";
export * from "./seo";
