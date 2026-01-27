/**
 * @domainstack/types
 *
 * Shared TypeScript interfaces for the DomainStack platform.
 *
 * Exports:
 * - domain: Domain scan response types (registration, DNS, hosting, certificates, etc.)
 * - notifications: Notification data and preference types
 * - provider: Provider information types
 * - tracked-domain: Tracked domain with provider details
 * - verification: Verification instruction and state types
 */

// Domain types
export * from "./domain";

// Other types
export type {
  ChannelToggles,
  NotificationData,
  UserNotificationPreferences,
} from "./notifications";

export type { ProviderInfo } from "./provider";

export type { TrackedDomainWithDetails } from "./tracked-domain";

export type {
  DnsInstructions,
  HtmlFileInstructions,
  MetaTagInstructions,
  ResumeDomainData,
  VerificationInstructions,
  VerificationState,
} from "./verification";
