import { z } from "zod";

/**
 * Schema for registration change details.
 * Tracks changes to registrar, nameservers, transfer lock, and statuses.
 */
export const RegistrationChangeSchema = z.object({
  // What changed
  registrarChanged: z.boolean(),
  nameserversChanged: z.boolean(),
  transferLockChanged: z.boolean(),
  statusesChanged: z.boolean(),

  // Previous values
  previousRegistrar: z.string().nullable(),
  previousNameservers: z.array(z.object({ host: z.string() })),
  previousTransferLock: z.boolean().nullable(),
  previousStatuses: z.array(z.string()),

  // New values
  newRegistrar: z.string().nullable(),
  newNameservers: z.array(z.object({ host: z.string() })),
  newTransferLock: z.boolean().nullable(),
  newStatuses: z.array(z.string()),
});

export type RegistrationChange = z.infer<typeof RegistrationChangeSchema>;

/**
 * Schema for provider change details.
 * Tracks which provider changed (DNS, hosting, or email) and the old/new provider names.
 */
export const ProviderChangeSchema = z.object({
  // What changed
  dnsProviderChanged: z.boolean(),
  hostingProviderChanged: z.boolean(),
  emailProviderChanged: z.boolean(),

  // Previous provider names (fetched from providers table)
  previousDnsProvider: z.string().nullable(),
  previousHostingProvider: z.string().nullable(),
  previousEmailProvider: z.string().nullable(),

  // New provider names
  newDnsProvider: z.string().nullable(),
  newHostingProvider: z.string().nullable(),
  newEmailProvider: z.string().nullable(),

  // Provider IDs for reference
  previousDnsProviderId: z.string().nullable(),
  previousHostingProviderId: z.string().nullable(),
  previousEmailProviderId: z.string().nullable(),
  newDnsProviderId: z.string().nullable(),
  newHostingProviderId: z.string().nullable(),
  newEmailProviderId: z.string().nullable(),
});

export type ProviderChange = z.infer<typeof ProviderChangeSchema>;

/**
 * Schema for certificate change details.
 * Tracks changes to CA provider and issuer.
 */
export const CertificateChangeSchema = z.object({
  // What changed
  caProviderChanged: z.boolean(),
  issuerChanged: z.boolean(),

  // Previous values
  previousCaProvider: z.string().nullable(),
  previousIssuer: z.string().nullable(),

  // New values
  newCaProvider: z.string().nullable(),
  newIssuer: z.string().nullable(),

  // Provider IDs for reference
  previousCaProviderId: z.string().nullable(),
  newCaProviderId: z.string().nullable(),
});

export type CertificateChange = z.infer<typeof CertificateChangeSchema>;
