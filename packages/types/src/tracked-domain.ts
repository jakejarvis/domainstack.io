/**
 * Tracked domain types - Plain TypeScript interfaces.
 *
 * These types are used across client and server code for tracked domains.
 */

import type {
  VerificationMethod,
  VerificationStatus,
} from "@domainstack/constants";
import type { ProviderInfo } from "./provider";

/**
 * A tracked domain with all provider details attached.
 * Used in dashboard components and hooks.
 */
export interface TrackedDomainWithDetails {
  id: string;
  userId: string;
  domainId: string;
  domainName: string;
  tld: string;
  verified: boolean;
  verificationMethod: VerificationMethod | null;
  verificationToken: string;
  verificationStatus: VerificationStatus;
  verificationFailedAt: Date | null;
  lastVerifiedAt: Date | null;
  muted: boolean;
  createdAt: Date;
  verifiedAt: Date | null;
  archivedAt: Date | null;
  expirationDate: Date | null;
  registrationDate: Date | null;
  registrar: ProviderInfo;
  dns: ProviderInfo;
  hosting: ProviderInfo;
  email: ProviderInfo;
  ca: ProviderInfo;
}
