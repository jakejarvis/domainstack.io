import { z } from "zod";

/**
 * Schema for registration snapshot data stored in JSONB.
 * Captures the state of domain registration at a point in time.
 */
export const RegistrationSnapshotSchema = z.object({
  registrarProviderId: z.string().uuid().nullable(),
  nameservers: z.array(z.object({ host: z.string() })),
  transferLock: z.boolean().nullable(),
  statuses: z.array(z.string()),
});

export type RegistrationSnapshotData = z.infer<
  typeof RegistrationSnapshotSchema
>;

/**
 * Schema for certificate snapshot data stored in JSONB.
 * Captures the state of the domain's SSL/TLS certificate at a point in time.
 */
export const CertificateSnapshotSchema = z.object({
  caProviderId: z.string().uuid().nullable(),
  issuer: z.string(),
  validTo: z.string(), // ISO date string
  fingerprint: z.string().nullable(),
});

export type CertificateSnapshotData = z.infer<typeof CertificateSnapshotSchema>;

/**
 * Schema for provider snapshot data.
 * Unlike registration and certificate data, provider IDs are stored in separate
 * database columns (dns_provider_id, hosting_provider_id, email_provider_id)
 * rather than in JSONB, to support efficient querying and foreign key constraints.
 */
export const ProviderSnapshotSchema = z.object({
  dnsProviderId: z.string().uuid().nullable(),
  hostingProviderId: z.string().uuid().nullable(),
  emailProviderId: z.string().uuid().nullable(),
});

export type ProviderSnapshotData = z.infer<typeof ProviderSnapshotSchema>;

/**
 * Schema for complete snapshot data.
 * Combines registration (JSONB), certificate (JSONB), and provider IDs (separate columns).
 * This is a logical grouping for application use, not a direct mapping to database storage.
 */
export const SnapshotDataSchema = z.object({
  registration: RegistrationSnapshotSchema,
  certificate: CertificateSnapshotSchema,
  providers: ProviderSnapshotSchema,
});

export type SnapshotData = z.infer<typeof SnapshotDataSchema>;

/**
 * Schema for creating a new snapshot.
 */
export const CreateSnapshotParamsSchema = z.object({
  trackedDomainId: z.string().uuid(),
  registration: RegistrationSnapshotSchema,
  certificate: CertificateSnapshotSchema,
  dnsProviderId: z.string().uuid().nullable(),
  hostingProviderId: z.string().uuid().nullable(),
  emailProviderId: z.string().uuid().nullable(),
});

export type CreateSnapshotParams = z.infer<typeof CreateSnapshotParamsSchema>;

/**
 * Schema for updating an existing snapshot.
 */
export const UpdateSnapshotParamsSchema = CreateSnapshotParamsSchema.partial();

export type UpdateSnapshotParams = z.infer<typeof UpdateSnapshotParamsSchema>;

/**
 * Schema for snapshot data used in monitoring.
 * Includes all snapshot fields plus user and domain metadata.
 */
export const SnapshotForMonitoringSchema = z.object({
  id: z.string().uuid(),
  trackedDomainId: z.string().uuid(),
  userId: z.string().uuid(),
  domainId: z.string().uuid(),
  domainName: z.string(),
  registration: RegistrationSnapshotSchema,
  certificate: CertificateSnapshotSchema,
  dnsProviderId: z.string().uuid().nullable(),
  hostingProviderId: z.string().uuid().nullable(),
  emailProviderId: z.string().uuid().nullable(),
  userEmail: z.string().email(),
  userName: z.string(),
});

export type SnapshotForMonitoring = z.infer<typeof SnapshotForMonitoringSchema>;
