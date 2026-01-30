/**
 * @domainstack/core
 *
 * Shared domain lookup logic for Domainstack.
 *
 * This package provides Node.js-only utilities for:
 * - Provider detection (hosting, email, DNS, registrar, CA)
 * - DNS-over-HTTPS queries
 * - TLS certificate fetching
 * - WHOIS/RDAP lookups
 *
 * @example
 * ```typescript
 * import { detectHostingProvider, getDefaultCatalog } from "@domainstack/core/providers";
 * import { queryDohProvider } from "@domainstack/core/dns";
 * import { fetchCertificateChain } from "@domainstack/core/tls";
 * import { lookupWhois } from "@domainstack/core/whois";
 * ```
 */

export * from "./dns";
export * from "./providers";
export * from "./tls";
export * from "./utils";
export * from "./whois";
