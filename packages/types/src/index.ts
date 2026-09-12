/**
 * @domainstack/types
 *
 * Shared TypeScript interfaces for the Domainstack platform.
 */

export * from "./domain";

export type {
  CertificateChangeKind,
  CertificateExpiryThreshold,
  DnsRecordType,
  DohProvider,
  DomainExpiryThreshold,
  ExpiryNotificationPrefix,
  NotifiableCertificateChangeKind,
  NotificationCategory,
  NotificationChannel,
  NotificationType,
  Plan,
  ProviderCategory,
  ProviderSource,
  RegistrarKey,
  RegistrationAvailability,
  RegistrationContactType,
  RegistrationSource,
  RegistrationUnavailableReason,
  VerificationMethod,
  VerificationStatus,
} from "./primitives";

export type {
  CertificateChange,
  CertificateChangeEvaluation,
  CertificateChangeWithNames,
  CertificateDampeningResult,
  PendingChangeObservation,
  ProviderChange,
  ProviderChangeWithNames,
  ProviderSnapshotData,
  RegistrationChange,
} from "./monitoring";

export type {
  ChannelToggles,
  NotificationData,
  UserNotificationPreferences,
} from "./notifications";

export type { ProviderInfo } from "./provider";

export type { ScreenshotData } from "./screenshot";

export type { SubscriptionQuota } from "./subscription";

export type { TrackedDomainWithDetails } from "./tracked-domain";

export type {
  DnsInstructions,
  HtmlFileInstructions,
  MetaTagInstructions,
  ResumeDomainData,
  VerificationInstructions,
  VerificationResult,
  VerificationState,
} from "./verification";
