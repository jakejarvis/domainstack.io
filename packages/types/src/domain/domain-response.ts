/**
 * Combined domain response type.
 */

import type { CertificatesResponse } from "./certificates";
import type { DnsRecordsResponse } from "./dns";
import type { HeadersResponse } from "./headers";
import type { HostingResponse } from "./hosting";
import type { RegistrationResponse } from "./registration";
import type { SeoResponse } from "./seo";
import type { TechnologiesResponse } from "./technologies";

export interface DomainResponse {
  registration: RegistrationResponse;
  dns: DnsRecordsResponse;
  hosting: HostingResponse;
  technologies: TechnologiesResponse;
  certificates: CertificatesResponse;
  headers: HeadersResponse;
  seo: SeoResponse;
}
