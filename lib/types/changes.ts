/**
 * Change detection types - Plain TypeScript interfaces.
 */

/**
 * Registration change details.
 */
export interface RegistrationChange {
  // What changed
  registrarChanged: boolean;
  nameserversChanged: boolean;
  transferLockChanged: boolean;
  statusesChanged: boolean;

  // Previous values
  previousRegistrar: string | null;
  previousNameservers: { host: string }[];
  previousTransferLock: boolean | null;
  previousStatuses: string[];

  // New values
  newRegistrar: string | null;
  newNameservers: { host: string }[];
  newTransferLock: boolean | null;
  newStatuses: string[];
}

/**
 * Provider change details.
 */
export interface ProviderChange {
  // What changed
  dnsProviderChanged: boolean;
  hostingProviderChanged: boolean;
  emailProviderChanged: boolean;

  // Previous provider names
  previousDnsProvider: string | null;
  previousHostingProvider: string | null;
  previousEmailProvider: string | null;

  // New provider names
  newDnsProvider: string | null;
  newHostingProvider: string | null;
  newEmailProvider: string | null;

  // Provider IDs for reference
  previousDnsProviderId: string | null;
  previousHostingProviderId: string | null;
  previousEmailProviderId: string | null;
  newDnsProviderId: string | null;
  newHostingProviderId: string | null;
  newEmailProviderId: string | null;
}

/**
 * Certificate change details.
 */
export interface CertificateChange {
  // What changed
  caProviderChanged: boolean;
  issuerChanged: boolean;

  // Previous values
  previousCaProvider: string | null;
  previousIssuer: string | null;

  // New values
  newCaProvider: string | null;
  newIssuer: string | null;

  // Provider IDs for reference
  previousCaProviderId: string | null;
  newCaProviderId: string | null;
}
