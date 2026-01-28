/**
 * Instantiated repository instances for the web application.
 *
 * All repos use dependency injection via factory functions from @domainstack/db.
 * The `db` instance is injected at import time, providing a clean separation
 * between the database client (Vercel-specific pooling) and the repo logic.
 */
import {
  createBlockedDomainsRepo,
  createCalendarFeedsRepo,
  createCertificatesRepo,
  createDnsRepo,
  createDomainsRepo,
  createFaviconsRepo,
  createHeadersRepo,
  createHostingRepo,
  createNotificationsRepo,
  createProviderLogosRepo,
  createProvidersRepo,
  createRegistrationsRepo,
  createScreenshotsRepo,
  createSeoRepo,
  createSnapshotsRepo,
  createTrackedDomainsRepo,
  createUserNotificationPreferencesRepo,
  createUserSubscriptionRepo,
  createUsersRepo,
} from "@domainstack/db/repos";
import { db } from "./client";

// Re-export types from @domainstack/db for convenience
export type {
  BlockedDomainsRepo,
  BulkOperationResult,
  CacheResult,
  CalendarFeedsRepo,
  CalendarFeedValidation,
  CertificatesRepo,
  CreateNotificationParams,
  CreateSnapshotParams,
  CreateTrackedDomainParams,
  CreateTrackedDomainWithLimitCheckResult,
  DbClient,
  DnsRepo,
  DomainsRepo,
  FaviconsRepo,
  GetTrackedDomainsOptions,
  HeadersRepo,
  HostingRepo,
  LinkedAccount,
  NotificationFilter,
  NotificationsRepo,
  ProviderLogosRepo,
  ProvidersRepo,
  RegistrationsRepo,
  ReplaceHeadersParams,
  ScreenshotsRepo,
  SeoRepo,
  SnapshotForMonitoring,
  SnapshotsRepo,
  TrackedDomainCertificate,
  TrackedDomainCounts,
  TrackedDomainForNotification,
  TrackedDomainForReverification,
  TrackedDomainsRepo,
  TrackedDomainWithDomainName,
  UnarchiveTrackedDomainWithLimitCheckResult,
  UpdateSnapshotParams,
  UpsertCertificatesParams,
  UpsertDnsParams,
  UpsertDomainParams,
  UserData,
  UserNotificationPreferencesRepo,
  UserSubscriptionData,
  UserSubscriptionRepo,
  UsersRepo,
  UserWithEndingSubscription,
} from "@domainstack/db/repos";

// Instantiate all repositories with the db client
export const blockedDomainsRepo = createBlockedDomainsRepo(db);
export const calendarFeedsRepo = createCalendarFeedsRepo(db);
export const certificatesRepo = createCertificatesRepo(db);
export const dnsRepo = createDnsRepo(db);
export const domainsRepo = createDomainsRepo(db);
export const faviconsRepo = createFaviconsRepo(db);
export const headersRepo = createHeadersRepo(db);
export const hostingRepo = createHostingRepo(db);
export const notificationsRepo = createNotificationsRepo(db);
export const providerLogosRepo = createProviderLogosRepo(db);
export const providersRepo = createProvidersRepo(db);
export const registrationsRepo = createRegistrationsRepo(db);
export const screenshotsRepo = createScreenshotsRepo(db);
export const seoRepo = createSeoRepo(db);
export const snapshotsRepo = createSnapshotsRepo(db);
export const trackedDomainsRepo = createTrackedDomainsRepo(db);
export const userNotificationPreferencesRepo =
  createUserNotificationPreferencesRepo(db);
export const userSubscriptionRepo = createUserSubscriptionRepo(db);
export const usersRepo = createUsersRepo(db);
