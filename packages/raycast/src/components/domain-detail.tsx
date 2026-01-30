import { Action, ActionPanel, Color, Detail, Icon } from "@raycast/api";
import { getFavicon } from "@raycast/utils";
import {
  formatDate,
  formatExpirationStatus,
  formatGeo,
  formatTtl,
  truncate,
} from "../utils/format";
import type { DomainLookupResult, ProviderRef } from "../utils/types";

/**
 * Get a favicon for a provider using their domain.
 */
function getProviderIcon(provider: ProviderRef | null | undefined) {
  if (!provider?.domain) return undefined;
  return getFavicon(`https://${provider.domain}`, { fallback: Icon.Globe });
}

interface DomainDetailProps {
  domain: string;
  data: DomainLookupResult;
  isLoading?: boolean;
}

/**
 * Build the markdown content for the domain report.
 */
function buildMarkdown(domain: string, data: DomainLookupResult): string {
  const sections: string[] = [];

  sections.push(`# ${domain}\n`);

  // Registration section
  if (data.registration?.success && data.registration.data) {
    const reg = data.registration.data;
    sections.push("## Registration");

    if (!reg.isRegistered) {
      sections.push("This domain is **not registered**.\n");
    } else {
      const registrationInfo: string[] = [];

      if (reg.registrar?.name) {
        registrationInfo.push(`**Registrar:** ${reg.registrar.name}`);
      }
      if (reg.creationDate) {
        registrationInfo.push(`**Created:** ${formatDate(reg.creationDate)}`);
      }
      if (reg.expirationDate) {
        registrationInfo.push(`**Expires:** ${formatDate(reg.expirationDate)}`);
      }
      if (reg.updatedDate) {
        registrationInfo.push(`**Updated:** ${formatDate(reg.updatedDate)}`);
      }
      if (reg.dnssec?.enabled !== undefined) {
        registrationInfo.push(
          `**DNSSEC:** ${reg.dnssec.enabled ? "Enabled" : "Disabled"}`,
        );
      }

      if (registrationInfo.length > 0) {
        sections.push(registrationInfo.join("\n"));
      }

      // Nameservers
      if (reg.nameservers && reg.nameservers.length > 0) {
        sections.push("\n**Nameservers:**");
        reg.nameservers.forEach((ns) => {
          sections.push(`- \`${ns.host}\``);
        });
      }

      // Statuses
      if (reg.statuses && reg.statuses.length > 0) {
        sections.push("\n**Status:**");
        reg.statuses.slice(0, 5).forEach((s) => {
          sections.push(`- ${s.status}`);
        });
        if (reg.statuses.length > 5) {
          sections.push(`- *...and ${reg.statuses.length - 5} more*`);
        }
      }
    }
    sections.push("");
  } else if (data.registration && !data.registration.success) {
    sections.push("## Registration");
    sections.push(`*Error: ${data.registration.error}*\n`);
  }

  // Hosting section
  if (data.hosting?.success && data.hosting.data) {
    const hosting = data.hosting.data;
    sections.push("## Hosting");

    const hostingInfo: string[] = [];

    if (hosting.hostingProvider?.name) {
      hostingInfo.push(`**Hosting:** ${hosting.hostingProvider.name}`);
    }
    if (hosting.dnsProvider?.name) {
      hostingInfo.push(`**DNS:** ${hosting.dnsProvider.name}`);
    }
    if (hosting.emailProvider?.name) {
      hostingInfo.push(`**Email:** ${hosting.emailProvider.name}`);
    }
    if (hosting.geo) {
      hostingInfo.push(`**Location:** ${formatGeo(hosting.geo)}`);
    }

    if (hostingInfo.length > 0) {
      sections.push(hostingInfo.join("\n"));
    }
    sections.push("");
  } else if (data.hosting && !data.hosting.success) {
    sections.push("## Hosting");
    sections.push(`*Error: ${data.hosting.error}*\n`);
  }

  // DNS section
  if (data.dns?.success && data.dns.data) {
    const dns = data.dns.data;
    sections.push("## DNS Records");

    if (dns.records.length === 0) {
      sections.push("No DNS records found.\n");
    } else {
      // Group records by type
      const groupedRecords = dns.records.reduce(
        (acc, record) => {
          if (!acc[record.type]) {
            acc[record.type] = [];
          }
          acc[record.type].push(record);
          return acc;
        },
        {} as Record<string, typeof dns.records>,
      );

      // Sort types: A, AAAA, CNAME, MX, TXT, NS, then others
      const typeOrder = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"];
      const sortedTypes = Object.keys(groupedRecords).sort((a, b) => {
        const aIndex = typeOrder.indexOf(a);
        const bIndex = typeOrder.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
      });

      for (const type of sortedTypes) {
        const records = groupedRecords[type];
        sections.push(`\n**${type}** (${records.length})`);

        for (const record of records.slice(0, 10)) {
          const value = truncate(record.value, 60);
          const ttl = record.ttl ? ` [${formatTtl(record.ttl)}]` : "";
          const priority =
            record.priority !== undefined
              ? ` (priority: ${record.priority})`
              : "";
          sections.push(`- \`${value}\`${priority}${ttl}`);
        }

        if (records.length > 10) {
          sections.push(`- *...and ${records.length - 10} more*`);
        }
      }
    }
    sections.push("");
  } else if (data.dns && !data.dns.success) {
    sections.push("## DNS Records");
    sections.push(`*Error: ${data.dns.error}*\n`);
  }

  // Certificates section
  if (data.certificates?.success && data.certificates.data) {
    const certs = data.certificates.data;
    sections.push("## SSL Certificates");

    if (certs.certificates.length === 0) {
      sections.push("No certificates found.\n");
    } else {
      for (const cert of certs.certificates.slice(0, 3)) {
        sections.push(`\n**${cert.subject}**`);
        sections.push(`- Issuer: ${cert.issuer}`);
        sections.push(
          `- Valid: ${formatDate(cert.validFrom)} - ${formatDate(cert.validTo)}`,
        );
        if (cert.altNames.length > 0) {
          const altNames = cert.altNames.slice(0, 3).join(", ");
          const more =
            cert.altNames.length > 3
              ? ` (+${cert.altNames.length - 3} more)`
              : "";
          sections.push(`- Alt Names: ${altNames}${more}`);
        }
      }
    }
    sections.push("");
  } else if (data.certificates && !data.certificates.success) {
    sections.push("## SSL Certificates");
    sections.push(`*Error: ${data.certificates.error}*\n`);
  }

  // Headers section
  if (data.headers?.success && data.headers.data) {
    const headers = data.headers.data;
    sections.push("## HTTP Headers");

    sections.push(
      `**Status:** ${headers.status} ${headers.statusMessage ?? ""}\n`,
    );

    // Show security-relevant headers
    const securityHeaders = [
      "content-security-policy",
      "strict-transport-security",
      "x-frame-options",
      "x-content-type-options",
      "x-xss-protection",
      "referrer-policy",
      "permissions-policy",
    ];

    const relevantHeaders = headers.headers.filter((h) =>
      securityHeaders.includes(h.name.toLowerCase()),
    );

    if (relevantHeaders.length > 0) {
      sections.push("**Security Headers:**");
      for (const h of relevantHeaders) {
        sections.push(`- \`${h.name}\`: ${truncate(h.value, 50)}`);
      }
    }

    // Show server header if present
    const serverHeader = headers.headers.find(
      (h) => h.name.toLowerCase() === "server",
    );
    if (serverHeader) {
      sections.push(`\n**Server:** ${serverHeader.value}`);
    }
    sections.push("");
  } else if (data.headers && !data.headers.success) {
    sections.push("## HTTP Headers");
    sections.push(`*Error: ${data.headers.error}*\n`);
  }

  // SEO section
  if (data.seo?.success && data.seo.data) {
    const seo = data.seo.data;
    sections.push("## SEO");

    if (seo.preview) {
      if (seo.preview.title) {
        sections.push(`**Title:** ${seo.preview.title}`);
      }
      if (seo.preview.description) {
        sections.push(
          `**Description:** ${truncate(seo.preview.description, 150)}`,
        );
      }
    }

    if (seo.meta?.general) {
      const { general } = seo.meta;
      if (general.robots) {
        sections.push(`**Robots:** ${general.robots}`);
      }
      if (general.canonical) {
        sections.push(`**Canonical:** ${general.canonical}`);
      }
    }

    if (seo.robots?.sitemaps && seo.robots.sitemaps.length > 0) {
      sections.push("\n**Sitemaps:**");
      for (const sitemap of seo.robots.sitemaps.slice(0, 3)) {
        sections.push(`- ${sitemap}`);
      }
    }
    sections.push("");
  } else if (data.seo && !data.seo.success) {
    sections.push("## SEO");
    sections.push(`*Error: ${data.seo.error}*\n`);
  }

  return sections.join("\n");
}

/**
 * Build metadata for the sidebar.
 */
function buildMetadata(
  domain: string,
  data: DomainLookupResult,
): React.ReactNode {
  const metadata: React.ReactNode[] = [];
  const domainUrl = `https://${domain}`;
  const domainFavicon = getFavicon(domainUrl, { fallback: Icon.Globe });

  // Domain with favicon at top
  metadata.push(
    <Detail.Metadata.Label
      key="domain-label"
      title="Domain"
      text={domain}
      icon={domainFavicon}
    />,
  );

  // Registration metadata
  if (data.registration?.success && data.registration.data?.isRegistered) {
    const reg = data.registration.data;

    if (reg.registrar?.name) {
      metadata.push(
        <Detail.Metadata.Label
          key="registrar"
          title="Registrar"
          text={reg.registrar.name}
          icon={getProviderIcon(reg.registrarProvider)}
        />,
      );
    }

    if (reg.expirationDate) {
      const expirationStatus = formatExpirationStatus(reg.expirationDate);
      const daysUntil = getDaysUntilExpiration(reg.expirationDate);

      metadata.push(
        <Detail.Metadata.Label
          key="expires"
          title="Expires"
          text={formatDate(reg.expirationDate)}
          icon={
            daysUntil !== null && daysUntil <= 30
              ? { source: Icon.Warning, tintColor: Color.Yellow }
              : undefined
          }
        />,
      );

      if (expirationStatus) {
        metadata.push(
          <Detail.Metadata.Label
            key="expiration-status"
            title=""
            text={expirationStatus}
          />,
        );
      }
    }

    if (reg.dnssec?.enabled !== undefined) {
      metadata.push(
        <Detail.Metadata.Label
          key="dnssec"
          title="DNSSEC"
          text={reg.dnssec.enabled ? "Enabled" : "Disabled"}
          icon={
            reg.dnssec.enabled
              ? { source: Icon.CheckCircle, tintColor: Color.Green }
              : { source: Icon.XMarkCircle, tintColor: Color.SecondaryText }
          }
        />,
      );
    }
  }

  // Hosting metadata
  if (data.hosting?.success && data.hosting.data) {
    const hosting = data.hosting.data;

    metadata.push(<Detail.Metadata.Separator key="sep-hosting" />);

    if (hosting.hostingProvider?.name) {
      metadata.push(
        <Detail.Metadata.Label
          key="hosting"
          title="Hosting"
          text={hosting.hostingProvider.name}
          icon={getProviderIcon(hosting.hostingProvider)}
        />,
      );
    }

    if (hosting.dnsProvider?.name) {
      metadata.push(
        <Detail.Metadata.Label
          key="dns-provider"
          title="DNS Provider"
          text={hosting.dnsProvider.name}
          icon={getProviderIcon(hosting.dnsProvider)}
        />,
      );
    }

    if (hosting.emailProvider?.name) {
      metadata.push(
        <Detail.Metadata.Label
          key="email-provider"
          title="Email"
          text={hosting.emailProvider.name}
          icon={getProviderIcon(hosting.emailProvider)}
        />,
      );
    }

    if (hosting.geo) {
      metadata.push(
        <Detail.Metadata.Label
          key="location"
          title="Location"
          text={formatGeo(hosting.geo)}
        />,
      );
    }
  }

  // Certificate metadata
  if (
    data.certificates?.success &&
    data.certificates.data.certificates.length > 0
  ) {
    const [cert] = data.certificates.data.certificates;

    metadata.push(<Detail.Metadata.Separator key="sep-certs" />);

    if (cert.caProvider?.name) {
      metadata.push(
        <Detail.Metadata.Label
          key="ssl-issuer"
          title="SSL Issuer"
          text={cert.caProvider.name}
          icon={getProviderIcon(cert.caProvider)}
        />,
      );
    }

    metadata.push(
      <Detail.Metadata.Label
        key="ssl-expires"
        title="SSL Expires"
        text={formatDate(cert.validTo)}
      />,
    );
  }

  // HTTP Status
  if (data.headers?.success && data.headers.data) {
    const { status } = data.headers.data;
    const statusColor =
      status >= 200 && status < 300
        ? Color.Green
        : status >= 400
          ? Color.Red
          : Color.Yellow;

    metadata.push(<Detail.Metadata.Separator key="sep-http" />);
    metadata.push(
      <Detail.Metadata.TagList key="http-status" title="HTTP Status">
        <Detail.Metadata.TagList.Item
          text={String(status)}
          color={statusColor}
        />
      </Detail.Metadata.TagList>,
    );
  }

  return <Detail.Metadata>{metadata}</Detail.Metadata>;
}

/**
 * Helper to calculate days until expiration.
 */
function getDaysUntilExpiration(expirationDate: string): number | null {
  try {
    const expDate = new Date(expirationDate);
    if (Number.isNaN(expDate.getTime())) return null;
    const now = new Date();
    const diffTime = expDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

/**
 * Format DNS records for copying.
 */
function formatDnsForCopy(data: DomainLookupResult): string {
  if (!data.dns?.success || !data.dns.data) return "";

  const lines: string[] = [];
  for (const record of data.dns.data.records) {
    const priority =
      record.priority !== undefined ? `\t${record.priority}` : "";
    const ttl = record.ttl ?? "";
    lines.push(
      `${record.name}\t${ttl}\tIN\t${record.type}${priority}\t${record.value}`,
    );
  }
  return lines.join("\n");
}

/**
 * Domain detail component showing the full report.
 */
export function DomainDetail({ domain, data, isLoading }: DomainDetailProps) {
  const markdown = buildMarkdown(domain, data);
  const metadata = buildMetadata(domain, data);

  const reportUrl = `https://domainstack.io/${domain}`;
  const domainUrl = `https://${domain}`;
  const dnsRecords = formatDnsForCopy(data);
  const domainFavicon = getFavicon(domainUrl, { fallback: Icon.Globe });

  return (
    <Detail
      isLoading={isLoading}
      navigationTitle={domain}
      markdown={markdown}
      metadata={metadata}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.OpenInBrowser
              title="Open Full Report"
              url={reportUrl}
              icon={Icon.Globe}
            />
            <Action.OpenInBrowser
              title="Visit Domain"
              url={domainUrl}
              icon={domainFavicon}
              shortcut={{ modifiers: ["cmd"], key: "o" }}
            />
          </ActionPanel.Section>

          <ActionPanel.Section>
            <Action.CopyToClipboard
              title="Copy Domain"
              content={domain}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
            <Action.CopyToClipboard
              title="Copy Report URL"
              content={reportUrl}
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
            />
            {dnsRecords && (
              <Action.CopyToClipboard
                title="Copy DNS Records"
                content={dnsRecords}
                shortcut={{ modifiers: ["cmd", "opt"], key: "c" }}
              />
            )}
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
