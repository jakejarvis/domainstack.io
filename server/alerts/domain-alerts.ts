import "server-only";

import { desc, eq } from "drizzle-orm";
import { BASE_URL } from "@/lib/constants/app";
import { db } from "@/lib/db/client";
import {
  certificates,
  domainMonitorSettings,
  domainMonitors,
  domains,
  registrations,
  users,
} from "@/lib/db/schema";

/**
 * Thresholds for expiry alerts (in days)
 */
const EXPIRY_THRESHOLDS = {
  URGENT: 7, // 7 days or less
  WARNING: 30, // 30 days or less
} as const;

interface ExpiryStatus {
  isExpiring: boolean;
  daysUntilExpiry: number;
  urgency: "urgent" | "warning" | "normal";
}

function getExpiryStatus(expiryDate: Date | null): ExpiryStatus {
  if (!expiryDate) {
    return {
      isExpiring: false,
      daysUntilExpiry: Number.POSITIVE_INFINITY,
      urgency: "normal",
    };
  }

  const now = new Date();
  const daysUntilExpiry = Math.ceil(
    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntilExpiry <= 0) {
    return { isExpiring: true, daysUntilExpiry, urgency: "urgent" };
  }

  if (daysUntilExpiry <= EXPIRY_THRESHOLDS.URGENT) {
    return { isExpiring: true, daysUntilExpiry, urgency: "urgent" };
  }

  if (daysUntilExpiry <= EXPIRY_THRESHOLDS.WARNING) {
    return { isExpiring: true, daysUntilExpiry, urgency: "warning" };
  }

  return { isExpiring: false, daysUntilExpiry, urgency: "normal" };
}

/**
 * Check for expiring domains and certificates, and send alerts to users who have monitoring enabled.
 *
 * This function is designed to be called by Inngest jobs on a regular schedule (e.g., daily).
 * It will:
 * 1. Find all monitored domains with expiring registrations or certificates
 * 2. Check each monitor's notification preferences
 * 3. Send email alerts to users where appropriate
 *
 * @param options - Configuration options for the alert check
 * @param options.dryRun - If true, log what would be sent but don't actually send emails
 * @param options.domainId - Optional: only check alerts for a specific domain
 */
export async function checkAndSendExpiryAlerts(options?: {
  dryRun?: boolean;
  domainId?: string;
}) {
  const dryRun = options?.dryRun ?? false;
  const specificDomainId = options?.domainId;

  console.info(
    JSON.stringify({
      level: "info",
      message: "[alerts] Starting expiry alert check",
      dryRun,
      specificDomainId,
      timestamp: new Date().toISOString(),
    }),
  );

  // Find all monitored domains with their expiry data
  const monitoredDomainsQuery = db
    .select({
      monitorId: domainMonitors.id,
      userId: domainMonitors.userId,
      userName: users.name,
      userEmail: users.email,
      domainId: domains.id,
      domainName: domains.name,
      unicodeName: domains.unicodeName,
      registrationExpiry: registrations.expirationDate,
      certExpiry: certificates.validTo,
      notifyOnDomainExpiry: domainMonitorSettings.notifyOnDomainExpiry,
      notifyOnCertExpiry: domainMonitorSettings.notifyOnCertExpiry,
    })
    .from(domainMonitors)
    .innerJoin(domains, eq(domainMonitors.domainId, domains.id))
    .innerJoin(users, eq(domainMonitors.userId, users.id))
    .leftJoin(
      registrations,
      eq(domainMonitors.domainId, registrations.domainId),
    )
    .leftJoin(certificates, eq(domainMonitors.domainId, certificates.domainId))
    .leftJoin(
      domainMonitorSettings,
      eq(domainMonitors.id, domainMonitorSettings.monitorId),
    )
    .orderBy(desc(domainMonitors.createdAt));

  // Filter by specific domain if provided
  const monitored = specificDomainId
    ? await monitoredDomainsQuery.where(eq(domains.id, specificDomainId))
    : await monitoredDomainsQuery;

  console.info(
    JSON.stringify({
      level: "info",
      message: "[alerts] Found monitored domains",
      count: monitored.length,
      timestamp: new Date().toISOString(),
    }),
  );

  const alertsToSend: Array<{
    userEmail: string;
    userName: string;
    domainName: string;
    alertType: "domain_expiry" | "cert_expiry";
    daysUntilExpiry: number;
    urgency: string;
  }> = [];

  for (const monitor of monitored) {
    // Check domain expiry
    if (monitor.notifyOnDomainExpiry && monitor.registrationExpiry) {
      const domainStatus = getExpiryStatus(monitor.registrationExpiry);

      if (domainStatus.isExpiring) {
        alertsToSend.push({
          userEmail: monitor.userEmail,
          userName: monitor.userName,
          domainName: monitor.unicodeName,
          alertType: "domain_expiry",
          daysUntilExpiry: domainStatus.daysUntilExpiry,
          urgency: domainStatus.urgency,
        });
      }
    }

    // Check certificate expiry
    if (monitor.notifyOnCertExpiry && monitor.certExpiry) {
      const certStatus = getExpiryStatus(monitor.certExpiry);

      if (certStatus.isExpiring) {
        alertsToSend.push({
          userEmail: monitor.userEmail,
          userName: monitor.userName,
          domainName: monitor.unicodeName,
          alertType: "cert_expiry",
          daysUntilExpiry: certStatus.daysUntilExpiry,
          urgency: certStatus.urgency,
        });
      }
    }
  }

  console.info(
    JSON.stringify({
      level: "info",
      message: "[alerts] Alerts to send",
      count: alertsToSend.length,
      dryRun,
      timestamp: new Date().toISOString(),
    }),
  );

  // Send alerts
  for (const alert of alertsToSend) {
    console.info(
      JSON.stringify({
        level: "info",
        message: "[alerts] Would send alert",
        alert,
        timestamp: new Date().toISOString(),
      }),
    );

    if (!dryRun) {
      // TODO: Actually send the email when ready
      // This is where you would call sendDomainAlertEmail()
      //
      // Example:
      // await sendDomainAlertEmail({
      //   to: alert.userEmail,
      //   subject: getAlertSubject(alert),
      //   html: getAlertHtml(alert),
      // });
      //
      // For now, we just log what would be sent
      console.warn(
        JSON.stringify({
          level: "warn",
          message:
            "[alerts] Email sending not yet implemented - see server/alerts/domain-alerts.ts",
          alert,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  return {
    totalChecked: monitored.length,
    alertsSent: dryRun ? 0 : alertsToSend.length,
    alertsQueued: alertsToSend.length,
  };
}

/**
 * Helper function to generate email subject based on alert
 * TODO: Customize these templates
 */
function getAlertSubject(alert: {
  domainName: string;
  alertType: string;
  urgency: string;
}): string {
  const prefix = alert.urgency === "urgent" ? "🚨 URGENT:" : "⚠️";
  const type =
    alert.alertType === "domain_expiry"
      ? "Domain registration"
      : "SSL certificate";

  return `${prefix} ${type} expiring soon for ${alert.domainName}`;
}

/**
 * Helper function to generate email HTML based on alert
 * TODO: Create proper email templates
 */
function getAlertHtml(alert: {
  userName: string;
  domainName: string;
  alertType: string;
  daysUntilExpiry: number;
}): string {
  const type =
    alert.alertType === "domain_expiry"
      ? "domain registration"
      : "SSL certificate";

  return `
    <h2>Hello ${alert.userName},</h2>
    <p>
      This is a reminder that the ${type} for <strong>${alert.domainName}</strong>
      is expiring in ${alert.daysUntilExpiry} day${alert.daysUntilExpiry !== 1 ? "s" : ""}.
    </p>
    <p>
      <a href="${BASE_URL}/${alert.domainName}">
        View domain details on Domainstack
      </a>
    </p>
    <p>
      <a href="${BASE_URL}/account/monitors">
        Manage your monitoring preferences
      </a>
    </p>
  `;
}

// Export helper functions for testing
export { getExpiryStatus, getAlertSubject, getAlertHtml };
