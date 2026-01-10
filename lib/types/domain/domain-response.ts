/**
 * Combined domain response type.
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
