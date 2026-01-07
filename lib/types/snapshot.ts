/**
 * Snapshot types - Plain TypeScript interfaces.
 *
 * These are internal data structures for tracking domain state changes.
 */

/**
 * Registration snapshot data stored in JSONB.
 */
export interface RegistrationSnapshotData {
  registrarProviderId: string | null;
  nameservers: { host: string }[];
  transferLock: boolean | null;
  statuses: string[];
}

/**
 * Certificate snapshot data stored in JSONB.
 */
export interface CertificateSnapshotData {
  caProviderId: string | null;
  issuer: string;
  validTo: string;
  fingerprint: string | null;
}

/**
 * Provider snapshot data (stored in separate columns, not JSONB).
 */
export interface ProviderSnapshotData {
  dnsProviderId: string | null;
  hostingProviderId: string | null;
  emailProviderId: string | null;
}

/**
 * Complete snapshot data combining all sources.
 */
export interface SnapshotData {
  registration: RegistrationSnapshotData;
  certificate: CertificateSnapshotData;
  providers: ProviderSnapshotData;
}

/**
 * Parameters for creating a new snapshot.
 */
export interface CreateSnapshotParams {
  trackedDomainId: string;
  registration: RegistrationSnapshotData;
  certificate: CertificateSnapshotData;
  dnsProviderId: string | null;
  hostingProviderId: string | null;
  emailProviderId: string | null;
}

/**
 * Parameters for updating an existing snapshot.
 * All fields optional - only provided fields are updated.
 */
export interface UpdateSnapshotParams {
  registration?: RegistrationSnapshotData;
  certificate?: CertificateSnapshotData;
  dnsProviderId?: string | null;
  hostingProviderId?: string | null;
  emailProviderId?: string | null;
}

/**
 * Snapshot data with user and domain metadata for monitoring.
 */
export interface SnapshotForMonitoring {
  id: string;
  trackedDomainId: string;
  userId: string;
  domainId: string;
  domainName: string;
  registration: unknown;
  certificate: unknown;
  dnsProviderId: string | null;
  hostingProviderId: string | null;
  emailProviderId: string | null;
  userEmail: string;
  userName: string;
}
