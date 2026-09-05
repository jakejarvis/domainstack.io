/**
 * Shared unions derived from `@domainstack/constants` arrays.
 *
 * Runtime values stay in constants. Import those arrays for switches,
 * pgEnums, and Records; import these unions for annotations.
 */

import type {
  CERTIFICATE_CHANGE_KINDS,
  DNS_RECORD_TYPES,
  DOH_PROVIDERS,
  DOMAIN_EXPIRY_THRESHOLDS,
  CERTIFICATE_EXPIRY_THRESHOLDS,
  NOTIFIABLE_CERTIFICATE_CHANGE_KINDS,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  PLANS,
  PROVIDER_CATEGORIES,
  PROVIDER_SOURCES,
  REGISTRAR_KEYS,
  REGISTRATION_AVAILABILITY,
  REGISTRATION_CONTACT_TYPES,
  REGISTRATION_SOURCES,
  REGISTRATION_UNAVAILABLE_REASONS,
  VERIFICATION_METHODS,
  VERIFICATION_STATUSES,
} from "@domainstack/constants";

export type Plan = (typeof PLANS)[number];

export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type DomainExpiryThreshold = (typeof DOMAIN_EXPIRY_THRESHOLDS)[number];
export type CertificateExpiryThreshold = (typeof CERTIFICATE_EXPIRY_THRESHOLDS)[number];

export type NotificationType =
  | `domain_expiry_${DomainExpiryThreshold}d`
  | `certificate_expiry_${CertificateExpiryThreshold}d`
  | "verification_failing"
  | "verification_revoked"
  | "registration_change"
  | "provider_change"
  | "certificate_change";

export type ExpiryNotificationPrefix = "domain_expiry" | "certificate_expiry";

export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];
export type ProviderSource = (typeof PROVIDER_SOURCES)[number];

export type RegistrationSource = (typeof REGISTRATION_SOURCES)[number];
export type RegistrationContactType = (typeof REGISTRATION_CONTACT_TYPES)[number];
export type RegistrationAvailability = (typeof REGISTRATION_AVAILABILITY)[number];
export type RegistrationUnavailableReason = (typeof REGISTRATION_UNAVAILABLE_REASONS)[number];

export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];
export type DohProvider = (typeof DOH_PROVIDERS)[number];

export type CertificateChangeKind = (typeof CERTIFICATE_CHANGE_KINDS)[number];
export type NotifiableCertificateChangeKind = (typeof NOTIFIABLE_CERTIFICATE_CHANGE_KINDS)[number];

export type RegistrarKey = (typeof REGISTRAR_KEYS)[number];
