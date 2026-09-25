import type {
  CertificateChangeKind,
  CertificateChangeWithNames,
  ProviderChangeWithNames,
  RegistrationChange,
} from "@domainstack/types";

/**
 * In-app title/message and email subject for a change alert.
 *
 * Pure and deterministic, so the detect-changes workflow can build copy in its
 * own (replayed) body; every name must already be resolved.
 */
export interface ChangeNotificationCopy {
  title: string;
  message: string;
  emailSubject: string;
}

function summarizeNameservers(hosts: string[]): string {
  const more = hosts.length > 2 ? ` (+${hosts.length - 2} more)` : "";
  return `${hosts.slice(0, 2).join(", ")}${more}`;
}

/** "X changed from A to B" / "X set to B" / "X A removed", or nothing if neither side is known. */
function describeSwap(
  label: string,
  removedLabel: string,
  previous: string | null,
  next: string | null,
): string | null {
  if (previous && next) return `${label} changed from ${previous} to ${next}`;
  if (next) return `${label} set to ${next}`;
  if (previous) return `${removedLabel} ${previous} removed`;
  return null;
}

function joinDetails(details: (string | null)[], fallback: string): string {
  const present = details.filter((d): d is string => d !== null);
  return present.length > 0 ? `${present.join(". ")}.` : fallback;
}

/** `change.previousRegistrar` / `newRegistrar` hold display names, not provider ids. */
export function describeRegistrationChange(
  change: RegistrationChange,
  domainName: string,
): ChangeNotificationCopy {
  const details: (string | null)[] = [];

  if (change.registrarChanged) {
    details.push(
      describeSwap("Registrar", "Registrar", change.previousRegistrar, change.newRegistrar),
    );
  }

  if (change.transferLockChanged) {
    if (change.newTransferLock === true) details.push("Transfer lock enabled");
    else if (change.newTransferLock === false) details.push("Transfer lock disabled");
  }

  if (change.nameserversChanged) {
    const previous = change.previousNameservers.map((ns) => ns.host);
    const next = change.newNameservers.map((ns) => ns.host);
    if (next.length > 0) {
      details.push(
        `Nameservers ${previous.length > 0 ? "changed to" : "set to"} ${summarizeNameservers(next)}`,
      );
    }
  }

  if (change.statusesChanged) {
    const previous = new Set(change.previousStatuses);
    const next = new Set(change.newStatuses);
    const added = change.newStatuses.filter((s) => !previous.has(s));
    const removed = change.previousStatuses.filter((s) => !next.has(s));
    if (added.length > 0) details.push(`Status added: ${added.join(", ")}`);
    if (removed.length > 0) details.push(`Status removed: ${removed.join(", ")}`);
  }

  // Title names the most significant change, in priority order.
  const primary = change.registrarChanged
    ? "Registrar"
    : change.transferLockChanged
      ? "Transfer lock"
      : change.nameserversChanged
        ? "Nameservers"
        : "Registration";

  const title = `${primary} changed for ${domainName}`;
  return {
    title,
    message: joinDetails(details, `Registration details updated for ${domainName}.`),
    emailSubject: `⚠️ ${title}`,
  };
}

export function describeUnregistered(
  domainName: string,
  previousRegistrar: string | null,
): ChangeNotificationCopy {
  const title = `${domainName} is no longer registered`;
  return {
    title,
    message: `The registry reports ${domainName} as unregistered${
      previousRegistrar ? ` (previously registered with ${previousRegistrar})` : ""
    }. If this is unexpected, contact your registrar immediately.`,
    emailSubject: `🚨 ${title}`,
  };
}

export function describeProviderChange(
  change: ProviderChangeWithNames,
  domainName: string,
): ChangeNotificationCopy {
  const details = [
    change.dnsProviderChanged
      ? describeSwap(
          "DNS provider",
          "DNS provider",
          change.previousDnsProvider,
          change.newDnsProvider,
        )
      : null,
    change.hostingProviderChanged
      ? describeSwap(
          "Hosting",
          "Hosting provider",
          change.previousHostingProvider,
          change.newHostingProvider,
        )
      : null,
    change.emailProviderChanged
      ? describeSwap(
          "Email provider",
          "Email provider",
          change.previousEmailProvider,
          change.newEmailProvider,
        )
      : null,
  ];

  const primary = change.dnsProviderChanged
    ? "DNS provider"
    : change.hostingProviderChanged
      ? "Hosting"
      : change.emailProviderChanged
        ? "Email provider"
        : "Provider";

  const title = `${primary} changed for ${domainName}`;
  return {
    title,
    message: joinDetails(details, `Provider configuration updated for ${domainName}.`),
    emailSubject: `🔄 ${title}`,
  };
}

const VALID_UNTIL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function formatValidUntil(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : VALID_UNTIL_FORMATTER.format(date);
}

export function describeCertificateChange(
  kind: CertificateChangeKind,
  change: CertificateChangeWithNames,
  validTo: string,
  domainName: string,
): ChangeNotificationCopy {
  const details: string[] = [];

  // A renewal only reports the new expiry; authority/issuer swaps are listed first.
  if (kind !== "renewal") {
    if (change.caProviderChanged) {
      const { previousCaProvider: prev, newCaProvider: next } = change;
      if (prev && next) details.push(`Certificate authority changed from ${prev} to ${next}`);
      else if (next) details.push(`Certificate authority set to ${next}`);
    }
    if (change.issuerChanged) {
      const { previousIssuer: prev, newIssuer: next } = change;
      if (prev && next) details.push(`Issuer changed from ${prev} to ${next}`);
      else if (next) details.push(`Issuer set to ${next}`);
    }
  }
  details.push(`Valid until ${formatValidUntil(validTo)}`);

  const title =
    kind === "renewal"
      ? `Certificate renewed for ${domainName}`
      : kind === "authority"
        ? `Certificate authority changed for ${domainName}`
        : `Certificate changed for ${domainName}`;

  return { title, message: `${details.join(". ")}.`, emailSubject: `🔒 ${title}` };
}
