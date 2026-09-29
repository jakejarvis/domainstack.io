/**
 * Notification steps used only by the detect-changes workflow: channel
 * determination, provider name resolution, and change-alert delivery.
 */

import type {
  CertificateChangeKind,
  CertificateChangeWithNames,
  ProviderChangeWithNames,
  RegistrationChange,
  UserNotificationPreferences,
} from "@domainstack/types";

import { type NotificationChannels, sendNotification } from "../steps/notifications";

/**
 * Step: Determine which notification channels to use based on user preferences.
 *
 * If the domain is archived, unverified, or muted, returns false for both
 * channels. Otherwise, falls back to global preferences.
 */
export async function determineNotificationChannelsStep(
  userId: string,
  trackedDomainId: string,
  preferenceType: keyof UserNotificationPreferences,
): Promise<NotificationChannels> {
  "use step";

  const { findTrackedDomainById, isTrackedDomainNotificationEligible } =
    await import("@domainstack/db/queries/tracked-domains");
  const { getUserNotificationPreferences } =
    await import("@domainstack/db/queries/user-notification-preferences");

  // Archived or unverified since the cron selected it: nothing to deliver.
  // `sendNotification` re-checks right before delivery; this skips work early.
  if (!(await isTrackedDomainNotificationEligible(trackedDomainId))) {
    return { shouldSendEmail: false, shouldSendInApp: false };
  }

  const trackedDomain = await findTrackedDomainById(trackedDomainId);
  if (!trackedDomain) {
    return { shouldSendEmail: false, shouldSendInApp: false };
  }

  // Muted domains receive no notifications
  if (trackedDomain.muted) {
    return { shouldSendEmail: false, shouldSendInApp: false };
  }

  // Fall back to global preferences
  const globalPrefs = await getUserNotificationPreferences(userId);
  const globalPref = globalPrefs[preferenceType];
  return {
    shouldSendEmail: globalPref.email,
    shouldSendInApp: globalPref.inApp,
  };
}

/**
 * Step: Resolve provider names from provider IDs.
 *
 * Returns a map of provider ID to provider name.
 */
export async function resolveProviderNamesStep(
  providerIds: string[],
): Promise<Map<string, string>> {
  "use step";

  if (providerIds.length === 0) return new Map();

  const { getProviderNames } = await import("@domainstack/db/queries/providers");

  return await getProviderNames(providerIds);
}

type ChangeNotification = {
  userId: string;
  userEmail: string;
  trackedDomainId: string;
  domainName: string;
  userName: string;
  title: string;
  message: string;
  emailSubject: string;
  /** Identifies the change (before > after), so a re-detected change dedupes the email. */
  idempotencyKey: string;
} & (
  | { type: "registration_change"; changes: RegistrationChange }
  | { type: "provider_change"; changes: ProviderChangeWithNames }
  | {
      type: "certificate_change";
      changes: CertificateChangeWithNames;
      kind: CertificateChangeKind;
      newValidTo: string;
    }
);

async function renderChangeEmail(notification: ChangeNotification): Promise<React.ReactElement> {
  const { getBaseUrl, getFirstName } = await import("../steps/email");
  const common = {
    userName: getFirstName(notification.userName),
    domainName: notification.domainName,
    baseUrl: getBaseUrl(),
  };

  switch (notification.type) {
    case "registration_change": {
      const { default: RegistrationChangeEmail } =
        await import("@domainstack/email/templates/registration-change");
      return RegistrationChangeEmail({ ...common, changes: notification.changes });
    }
    case "provider_change": {
      const { default: ProviderChangeEmail } =
        await import("@domainstack/email/templates/provider-change");
      return ProviderChangeEmail({ ...common, changes: notification.changes });
    }
    case "certificate_change": {
      const { default: CertificateChangeEmail } =
        await import("@domainstack/email/templates/certificate-change");
      return CertificateChangeEmail({
        ...common,
        kind: notification.kind,
        changes: notification.changes,
        newValidTo: notification.newValidTo,
      });
    }
  }
}

/**
 * Step: Send a registration, provider, or certificate change alert via email
 * and/or in-app, as `channels` allows.
 */
export async function sendChangeNotificationStep(
  notification: ChangeNotification,
  channels: NotificationChannels,
): Promise<boolean> {
  "use step";

  const emailComponent = channels.shouldSendEmail
    ? await renderChangeEmail(notification)
    : undefined;

  return await sendNotification(
    {
      userId: notification.userId,
      userEmail: notification.userEmail,
      trackedDomainId: notification.trackedDomainId,
      domainName: notification.domainName,
      notificationType: notification.type,
      title: notification.title,
      message: notification.message,
      emailSubject: notification.emailSubject,
      emailComponent,
      idempotencyKey: notification.idempotencyKey,
    },
    channels,
  );
}
