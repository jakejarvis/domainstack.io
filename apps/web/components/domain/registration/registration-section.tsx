import {
  IconAlertCircle,
  IconRosetteDiscountCheck,
  IconSchool,
  IconSpy,
} from "@tabler/icons-react";

import { KeyValue } from "@/components/domain/key-value";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { RawDataDialog } from "@/components/domain/registration/raw-data-dialog";
import { RelativeAgeString } from "@/components/domain/relative-age";
import { RelativeExpiryString } from "@/components/domain/relative-expiry";
import { ReportSection } from "@/components/domain/report-section";
import { ProviderLogo } from "@/components/icons/provider-logo";
import { sections } from "@/lib/constants/sections";
import type { RegistrationResponse } from "@domainstack/types";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { formatDate, formatDateTimeUtc, toDateTimeAttr } from "@domainstack/utils/date";

type RegistrantView = { organization: string; country: string; state?: string };

function getUnavailableMessage(data: RegistrationResponse): string {
  if (data.unavailableReason === "timeout") {
    return "WHOIS/RDAP lookup timed out. This may be a temporary issue with the registry's servers.";
  }
  if (data.unavailableReason === "unsupported_tld") {
    return `The .${data.tld} registry does not publish public WHOIS/RDAP data. Registration details cannot be verified for this domain.`;
  }
  return "Registration information could not be retrieved at this time.";
}

function getRegistrationSource(data: RegistrationResponse) {
  const serverUrl =
    data.rdapServers && data.rdapServers.length > 0
      ? data.rdapServers[data.rdapServers.length - 1]
      : undefined;
  const serverName = serverUrl
    ? (extractSourceDomain(serverUrl) ?? "RDAP")
    : (data.whoisServer ?? "WHOIS");
  const learnUrl =
    data.source === "rdap" ? "https://about.rdap.org/" : "https://en.wikipedia.org/wiki/WHOIS";
  return { serverUrl, serverName, learnUrl };
}

function RegistrationUnavailableNotice({ data }: { data: RegistrationResponse }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning-border bg-warning-border/10 p-4 text-sm backdrop-blur-lg dark:bg-warning-border/10">
      <IconAlertCircle
        className="mt-0.5 size-4 shrink-0 text-yellow-800 dark:text-yellow-200"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="font-medium text-yellow-800 dark:text-yellow-200">
          Registration Data Unavailable
        </p>
        <p className="text-yellow-800/90 dark:text-yellow-200/80">{getUnavailableMessage(data)}</p>
      </div>
    </div>
  );
}

function RegistrarVerifiedBy({
  serverUrl,
  serverName,
  learnUrl,
  source,
}: {
  serverUrl?: string;
  serverName: string;
  learnUrl: string;
  source: RegistrationResponse["source"];
}) {
  return (
    <ResponsiveTooltip>
      <ResponsiveTooltipTrigger
        nativeButton={false}
        render={
          <IconRosetteDiscountCheck
            className="!size-3.5 text-muted-foreground/80"
            aria-hidden="true"
          />
        }
      />
      <ResponsiveTooltipContent>
        <div className="flex items-center gap-[5px]">
          <span>
            Verified by{" "}
            <span className="font-medium">
              {serverUrl ? (
                <a
                  href={serverUrl}
                  target="_blank"
                  rel="noopener"
                  className="underline underline-offset-2"
                >
                  {serverName}
                </a>
              ) : (
                serverName
              )}
            </span>
          </span>
          <a
            href={learnUrl}
            target="_blank"
            rel="noopener"
            title={`Learn about ${source === "rdap" ? "RDAP" : "WHOIS"}`}
            className="text-muted/80"
          >
            <IconSchool className="size-3" />
          </a>
        </div>
      </ResponsiveTooltipContent>
    </ResponsiveTooltip>
  );
}

function RegistrationDetailsGrid({ data }: { data: RegistrationResponse }) {
  const registrant = extractRegistrantView(data);
  const { serverUrl, serverName, learnUrl } = getRegistrationSource(data);
  const isHidden = data.privacyEnabled || !registrant;

  return (
    <KeyValueGrid colsDesktop={2}>
      <KeyValue
        label="Registrar"
        value={data.registrarProvider?.name || "Unknown"}
        leading={
          data.registrarProvider?.id ? (
            <ProviderLogo
              providerId={data.registrarProvider.id}
              providerName={data.registrarProvider.name}
            />
          ) : undefined
        }
        suffix={
          <RegistrarVerifiedBy
            serverUrl={serverUrl}
            serverName={serverName}
            learnUrl={learnUrl}
            source={data.source}
          />
        }
      />

      <KeyValue
        label="Registrant"
        value={registrant && !data.privacyEnabled ? formatRegistrant(registrant) : "Hidden"}
        leading={
          isHidden ? <IconSpy className="text-muted-foreground" aria-hidden="true" /> : undefined
        }
      />

      <KeyValue
        label="Created"
        value={
          data.creationDate ? (
            <time dateTime={toDateTimeAttr(data.creationDate)} suppressHydrationWarning>
              {formatDate(data.creationDate)}
            </time>
          ) : (
            "Unknown"
          )
        }
        valueTooltip={
          data.creationDate ? (
            <time dateTime={toDateTimeAttr(data.creationDate)} suppressHydrationWarning>
              {formatDateTimeUtc(data.creationDate)}
            </time>
          ) : undefined
        }
        suffix={
          data.creationDate ? (
            <span className="text-[11px] leading-none text-muted-foreground">
              <RelativeAgeString from={data.creationDate} />
            </span>
          ) : null
        }
      />

      <KeyValue
        label="Expires"
        value={
          data.expirationDate ? (
            <time dateTime={toDateTimeAttr(data.expirationDate)} suppressHydrationWarning>
              {formatDate(data.expirationDate)}
            </time>
          ) : (
            "Unknown"
          )
        }
        valueTooltip={
          data.expirationDate ? (
            <time dateTime={toDateTimeAttr(data.expirationDate)} suppressHydrationWarning>
              {formatDateTimeUtc(data.expirationDate)}
            </time>
          ) : undefined
        }
        suffix={
          data.expirationDate ? (
            <span className="text-[11px] leading-none text-muted-foreground">
              <RelativeExpiryString to={data.expirationDate} dangerDays={30} warnDays={45} />
            </span>
          ) : null
        }
      />
    </KeyValueGrid>
  );
}

export function RegistrationSection({
  data,
}: {
  domain?: string;
  data?: RegistrationResponse | null;
}) {
  if (!data) return null;

  const isWhoisUnavailable = data.status === "unknown";
  const { serverUrl, serverName } = getRegistrationSource(data);

  return (
    <ReportSection
      {...sections.registration}
      headerActions={
        data.rawResponse ? (
          <RawDataDialog
            domain={data.domain}
            format={data.source === "rdap" ? "RDAP" : "WHOIS"}
            data={data.rawResponse}
            serverName={serverName}
            serverUrl={serverUrl}
          />
        ) : undefined
      }
    >
      {isWhoisUnavailable ? (
        <RegistrationUnavailableNotice data={data} />
      ) : (
        <RegistrationDetailsGrid data={data} />
      )}
    </ReportSection>
  );
}

export function formatRegistrant(reg: { organization: string; country: string; state?: string }) {
  const org = (reg.organization || "").trim();
  const country = (reg.country || "").trim();
  const state = (reg.state || "").trim();
  const parts = [] as string[];
  if (org) parts.push(org);
  const loc = [state, country].filter(Boolean).join(", ");
  if (loc) parts.push(loc);
  if (parts.length === 0) return "Unavailable";
  return parts.join(" — ");
}

function extractRegistrantView(record: RegistrationResponse): RegistrantView | null {
  const registrant = record.contacts?.find((c) => c.type === "registrant");
  if (!registrant) return null;
  const organization = (registrant.organization || registrant.name || "").trim() || "Unknown";
  const country = registrant.country || registrant.countryCode || "";
  const state = registrant.state || "" || undefined;
  return { organization, country, state };
}

function extractSourceDomain(input: string | undefined | null): string | undefined {
  if (!input) return;
  const value = String(input).trim();
  if (!value) return;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.hostname || undefined;
  } catch {
    return;
  }
}
