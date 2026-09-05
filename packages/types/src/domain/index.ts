/**
 * Domain response types.
 */

export type {
  Certificate,
  CertificatePendingObservation,
  CertificateRecentIdentity,
  CertificateSnapshotData,
  CertificatesResponse,
} from "./certificates";

export type { DnsRecord, DnsRecordsResponse } from "./dns";
export type { DomainResponse } from "./domain-response";
export type { Header, HeadersResponse } from "./headers";
export type { GeoIpData, HostingGeo, HostingResponse, ProviderDetectionData } from "./hosting";
export type { FaviconResponse, IconResponse, ProviderLogoResponse } from "./icon";
export type { ProviderRef } from "./provider-ref";
export type {
  RegistrationContact,
  RegistrationNameserver,
  RegistrationResponse,
  RegistrationSnapshotData,
  RegistrationStatus,
} from "./registration";
export type {
  GeneralMeta,
  OpenGraphMeta,
  RobotsGroup,
  RobotsRule,
  RobotsTxt,
  SeoMeta,
  SeoPreview,
  SeoResponse,
  TwitterMeta,
} from "./seo";
