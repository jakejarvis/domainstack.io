// Re-export all repo factories and types

// Re-export shared types
export type { CacheResult, DbClient } from "../types";

// Blocked domains
export {
  type BlockedDomainsRepo,
  createBlockedDomainsRepo,
} from "./blocked-domains";

// Calendar feeds
export {
  type CalendarFeedsRepo,
  type CalendarFeedValidation,
  createCalendarFeedsRepo,
} from "./calendar-feeds";

// Certificates
export {
  type CertificatesRepo,
  createCertificatesRepo,
  type TrackedDomainCertificate,
  type UpsertCertificatesParams,
} from "./certificates";

// DNS
export { createDnsRepo, type DnsRepo, type UpsertDnsParams } from "./dns";

// Domains
export {
  createDomainsRepo,
  type DomainsRepo,
  type UpsertDomainParams,
} from "./domains";

// Favicons
export { createFaviconsRepo, type FaviconsRepo } from "./favicons";

// Headers
export {
  createHeadersRepo,
  type HeadersRepo,
  type ReplaceHeadersParams,
} from "./headers";

// Hosting
export { createHostingRepo, type HostingRepo } from "./hosting";

// Notifications
export {
  type CreateNotificationParams,
  createNotificationsRepo,
  type NotificationFilter,
  type NotificationsRepo,
} from "./notifications";

// Provider logos
export {
  createProviderLogosRepo,
  type ProviderLogosRepo,
} from "./provider-logos";

// Providers
export { createProvidersRepo, type ProvidersRepo } from "./providers";

// Registrations
export {
  createRegistrationsRepo,
  type RegistrationsRepo,
} from "./registrations";

// Screenshots
export { createScreenshotsRepo, type ScreenshotsRepo } from "./screenshots";

// SEO
export { createSeoRepo, type SeoRepo } from "./seo";

// Snapshots
export {
  type CreateSnapshotParams,
  createSnapshotsRepo,
  type SnapshotForMonitoring,
  type SnapshotsRepo,
  type UpdateSnapshotParams,
} from "./snapshots";

// Tracked domains
export {
  type BulkOperationResult,
  type CreateTrackedDomainParams,
  type CreateTrackedDomainWithLimitCheckResult,
  createTrackedDomainsRepo,
  type GetTrackedDomainsOptions,
  type TrackedDomainCounts,
  type TrackedDomainForNotification,
  type TrackedDomainForReverification,
  type TrackedDomainsRepo,
  type TrackedDomainWithDomainName,
  type UnarchiveTrackedDomainWithLimitCheckResult,
} from "./tracked-domains";

// User notification preferences
export {
  createUserNotificationPreferencesRepo,
  type UserNotificationPreferencesRepo,
} from "./user-notification-preferences";

// User subscription
export {
  createUserSubscriptionRepo,
  type UserSubscriptionData,
  type UserSubscriptionRepo,
  type UserWithEndingSubscription,
} from "./user-subscription";

// Users
export {
  createUsersRepo,
  type LinkedAccount,
  type UserData,
  type UsersRepo,
} from "./users";
