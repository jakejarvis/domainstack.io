/**
 * Shared notification workflow steps.
 *
 * These steps handle notification channel determination, provider name resolution,
 * and notification sending for monitoring workflows.
 */

import type { NotificationOverrides } from "@/lib/types/notifications";

export interface NotificationChannels {
  shouldSendEmail: boolean;
  shouldSendInApp: boolean;
}

/**
 * Step: Determine which notification channels to use based on user preferences.
 */
export async function determineNotificationChannelsStep(
  userId: string,
  trackedDomainId: string,
  preferenceType: keyof NotificationOverrides,
): Promise<NotificationChannels> {
  "use step";

  const { determineNotificationChannels } = await import("@/lib/notifications");

  return await determineNotificationChannels(
    userId,
    trackedDomainId,
    preferenceType,
  );
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

  const { getProviderNames } = await import("@/lib/db/repos/providers");

  return await getProviderNames(providerIds);
}

/**
 * Step: Send registration change notification via email and/or in-app.
 *
 * Imports email component and uses step ID as idempotency key.
 */
export async function sendRegistrationChangeNotificationStep(
  params: {
    userId: string;
    userEmail: string;
    trackedDomainId: string;
    domainName: string;
    userName: string;
    title: string;
    message: string;
    emailSubject: string;
    changes: {
      registrarChanged: boolean;
      nameserversChanged: boolean;
      transferLockChanged: boolean;
      statusesChanged: boolean;
      previousRegistrar?: string;
      newRegistrar?: string;
      previousNameservers: { host: string }[];
      newNameservers: { host: string }[];
      previousTransferLock?: boolean;
      newTransferLock?: boolean;
      previousStatuses: string[];
      newStatuses: string[];
    };
  },
  shouldSendEmail: boolean,
  shouldSendInApp: boolean,
): Promise<boolean> {
  "use step";

  const { getStepMetadata } = await import("workflow");
  const { sendNotification } = await import("@/lib/notifications");
  const { default: RegistrationChangeEmail } = await import(
    "@/emails/registration-change"
  );

  const { stepId } = getStepMetadata();

  const emailComponent = RegistrationChangeEmail({
    userName: params.userName.split(" ")[0] || "there",
    domainName: params.domainName,
    changes: params.changes,
  });

  return await sendNotification(
    {
      userId: params.userId,
      userEmail: params.userEmail,
      trackedDomainId: params.trackedDomainId,
      domainName: params.domainName,
      notificationType: "registration_change",
      title: params.title,
      message: params.message,
      emailSubject: params.emailSubject,
      emailComponent,
      idempotencyKey: stepId,
    },
    shouldSendEmail,
    shouldSendInApp,
  );
}

/**
 * Step: Send provider change notification via email and/or in-app.
 *
 * Imports email component and uses step ID as idempotency key.
 */
export async function sendProviderChangeNotificationStep(
  params: {
    userId: string;
    userEmail: string;
    trackedDomainId: string;
    domainName: string;
    userName: string;
    title: string;
    message: string;
    emailSubject: string;
    changes: {
      dnsProviderChanged: boolean;
      hostingProviderChanged: boolean;
      emailProviderChanged: boolean;
      previousDnsProviderId: string | null;
      newDnsProviderId: string | null;
      previousHostingProviderId: string | null;
      newHostingProviderId: string | null;
      previousEmailProviderId: string | null;
      newEmailProviderId: string | null;
      previousDnsProvider: string | null;
      newDnsProvider: string | null;
      previousHostingProvider: string | null;
      newHostingProvider: string | null;
      previousEmailProvider: string | null;
      newEmailProvider: string | null;
    };
  },
  shouldSendEmail: boolean,
  shouldSendInApp: boolean,
): Promise<boolean> {
  "use step";

  const { getStepMetadata } = await import("workflow");
  const { sendNotification } = await import("@/lib/notifications");
  const { default: ProviderChangeEmail } = await import(
    "@/emails/provider-change"
  );

  const { stepId } = getStepMetadata();

  const emailComponent = ProviderChangeEmail({
    userName: params.userName.split(" ")[0] || "there",
    domainName: params.domainName,
    changes: params.changes,
  });

  return await sendNotification(
    {
      userId: params.userId,
      userEmail: params.userEmail,
      trackedDomainId: params.trackedDomainId,
      domainName: params.domainName,
      notificationType: "provider_change",
      title: params.title,
      message: params.message,
      emailSubject: params.emailSubject,
      emailComponent,
      idempotencyKey: stepId,
    },
    shouldSendEmail,
    shouldSendInApp,
  );
}

/**
 * Step: Send certificate change notification via email and/or in-app.
 *
 * Imports email component and uses step ID as idempotency key.
 */
export async function sendCertificateChangeNotificationStep(
  params: {
    userId: string;
    userEmail: string;
    trackedDomainId: string;
    domainName: string;
    userName: string;
    title: string;
    message: string;
    emailSubject: string;
    newValidTo: string;
    changes: {
      caProviderChanged: boolean;
      issuerChanged: boolean;
      previousCaProviderId: string | null;
      newCaProviderId: string | null;
      previousIssuer: string | null;
      newIssuer: string | null;
      previousCaProvider: string | null;
      newCaProvider: string | null;
    };
  },
  shouldSendEmail: boolean,
  shouldSendInApp: boolean,
): Promise<boolean> {
  "use step";

  const { getStepMetadata } = await import("workflow");
  const { sendNotification } = await import("@/lib/notifications");
  const { default: CertificateChangeEmail } = await import(
    "@/emails/certificate-change"
  );

  const { stepId } = getStepMetadata();

  const emailComponent = CertificateChangeEmail({
    userName: params.userName.split(" ")[0] || "there",
    domainName: params.domainName,
    changes: params.changes,
    newValidTo: params.newValidTo,
  });

  return await sendNotification(
    {
      userId: params.userId,
      userEmail: params.userEmail,
      trackedDomainId: params.trackedDomainId,
      domainName: params.domainName,
      notificationType: "certificate_change",
      title: params.title,
      message: params.message,
      emailSubject: params.emailSubject,
      emailComponent,
      idempotencyKey: stepId,
    },
    shouldSendEmail,
    shouldSendInApp,
  );
}
