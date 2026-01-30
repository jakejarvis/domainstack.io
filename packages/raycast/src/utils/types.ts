/**
 * API response types for Domainstack endpoints.
 * These mirror the types from @domainstack/types but are self-contained
 * to avoid monorepo dependencies in the Raycast extension.
 */

/**
 * Lightweight provider reference for identification.
 */
export interface ProviderRef {
  id: string | null;
  name: string | null;
  domain: string | null;
}

/**
 * Type of registration contact.
 */
export type RegistrationContactType =
  | "registrant"
  | "admin"
  | "tech"
  | "billing"
  | "abuse"
  | "registrar"
  | "reseller"
  | "unknown";

/**
 * Registration contact information from WHOIS/RDAP.
 */
export interface RegistrationContact {
  type: RegistrationContactType;
  name?: string;
  organization?: string;
  email?: string | string[];
  phone?: string | string[];
  fax?: string | string[];
  street?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  countryCode?: string;
}

/**
 * Nameserver information.
 */
export interface RegistrationNameserver {
  host: string;
  ipv4?: string[];
  ipv6?: string[];
}

/**
 * Registration status with description.
 */
export interface RegistrationStatus {
  status: string;
  description?: string;
  raw?: string;
}

/**
 * Full registration response from WHOIS/RDAP lookup.
 */
export interface RegistrationResponse {
  domainId?: string;
  domain: string;
  tld: string;
  isRegistered: boolean;
  status: "registered" | "unregistered" | "unknown";
  unavailableReason?: "unsupported_tld" | "timeout";
  unicodeName?: string;
  punycodeName?: string;
  registry?: string;
  registrar?: {
    name?: string;
    ianaId?: string;
    url?: string;
    email?: string;
    phone?: string;
  };
  reseller?: string;
  statuses?: RegistrationStatus[];
  creationDate?: string;
  updatedDate?: string;
  expirationDate?: string;
  deletionDate?: string;
  transferLock?: boolean;
  dnssec?: {
    enabled: boolean;
    dsRecords?: {
      keyTag?: number;
      algorithm?: number;
      digestType?: number;
      digest?: string;
    }[];
  };
  nameservers?: RegistrationNameserver[];
  contacts?: RegistrationContact[];
  privacyEnabled?: boolean;
  whoisServer?: string;
  rdapServers?: string[];
  source: string | null;
  warnings?: string[];
  registrarProvider: ProviderRef;
  rawResponse?: Record<string, unknown> | string;
}

/**
 * A single DNS record.
 */
export interface DnsRecord {
  type: string;
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
  isCloudflare?: boolean;
}

/**
 * Response from DNS resolution.
 */
export interface DnsRecordsResponse {
  records: DnsRecord[];
  resolver: string | null;
}

/**
 * Geo location data for hosting.
 */
export interface HostingGeo {
  city: string;
  region: string;
  country: string;
  country_code: string;
  lat: number | null;
  lon: number | null;
}

/**
 * Response from hosting detection.
 */
export interface HostingResponse {
  hostingProvider: ProviderRef;
  emailProvider: ProviderRef;
  dnsProvider: ProviderRef;
  geo: HostingGeo | null;
}

/**
 * A single SSL/TLS certificate.
 */
export interface Certificate {
  issuer: string;
  subject: string;
  altNames: string[];
  validFrom: string;
  validTo: string;
  caProvider: ProviderRef;
}

/**
 * Response from certificate chain fetch.
 */
export interface CertificatesResponse {
  certificates: Certificate[];
  error?: string;
}

/**
 * A single HTTP header.
 */
export interface Header {
  name: string;
  value: string;
}

/**
 * Response from HTTP header probe.
 */
export interface HeadersResponse {
  headers: Header[];
  status: number;
  statusMessage?: string;
}

/**
 * OpenGraph meta tags.
 */
export interface OpenGraphMeta {
  title?: string;
  description?: string;
  type?: string;
  url?: string;
  siteName?: string;
  images?: string[];
}

/**
 * Twitter card meta tags.
 */
export interface TwitterMeta {
  card?: string;
  title?: string;
  description?: string;
  image?: string;
}

/**
 * General HTML meta tags.
 */
export interface GeneralMeta {
  title?: string;
  description?: string;
  keywords?: string;
  author?: string;
  canonical?: string;
  generator?: string;
  robots?: string;
}

/**
 * Combined SEO meta tags.
 */
export interface SeoMeta {
  openGraph: OpenGraphMeta;
  twitter: TwitterMeta;
  general: GeneralMeta;
}

/**
 * SEO preview data for social sharing.
 */
export interface SeoPreview {
  title: string | null;
  description: string | null;
  image: string | null;
  imageUploaded?: string | null;
  canonicalUrl: string;
}

/**
 * Robots.txt rule.
 */
export type RobotsRule =
  | { type: "allow"; value: string }
  | { type: "disallow"; value: string }
  | { type: "crawlDelay"; value: string }
  | { type: "contentSignal"; value: string };

/**
 * Robots.txt user-agent group.
 */
export interface RobotsGroup {
  userAgents: string[];
  rules: RobotsRule[];
}

/**
 * Parsed robots.txt data.
 */
export interface RobotsTxt {
  fetched: boolean;
  groups: RobotsGroup[];
  sitemaps: string[];
}

/**
 * Full SEO response.
 */
export interface SeoResponse {
  meta: SeoMeta | null;
  robots: RobotsTxt | null;
  preview: SeoPreview | null;
  source: {
    finalUrl: string | null;
    status: number | null;
  };
  errors?: {
    html?: string;
    robots?: string;
  };
}

/**
 * tRPC response wrapper for successful responses.
 */
export interface TRPCSuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * tRPC response wrapper for failed responses.
 */
export interface TRPCErrorResponse {
  success: false;
  error: string;
}

/**
 * Combined tRPC response type.
 */
export type TRPCResponse<T> = TRPCSuccessResponse<T> | TRPCErrorResponse;

/**
 * Combined domain lookup result.
 */
export interface DomainLookupResult {
  registration: TRPCResponse<RegistrationResponse> | null;
  dns: TRPCResponse<DnsRecordsResponse> | null;
  hosting: TRPCResponse<HostingResponse> | null;
  certificates: TRPCResponse<CertificatesResponse> | null;
  headers: TRPCResponse<HeadersResponse> | null;
  seo: TRPCResponse<SeoResponse> | null;
}
