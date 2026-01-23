import {
  DetectiveIcon,
  GraduationCapIcon,
  SealCheckIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/ssr";
import { KeyValue } from "@/components/domain/key-value";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { RawDataDialog } from "@/components/domain/registration/raw-data-dialog";
import { RelativeAgeString } from "@/components/domain/relative-age";
import { RelativeExpiryString } from "@/components/domain/relative-expiry";
import { ReportSection } from "@/components/domain/report-section";
import { ProviderLogo } from "@/components/icons/provider-logo";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import { sections } from "@/lib/constants/sections";
import { formatDate, formatDateTimeUtc } from "@/lib/format";
import type { RegistrationResponse } from "@/lib/types/domain/registration";

type RegistrantView = { organization: string; country: string; state?: string };

export function RegistrationSection({
  data,
}: {
  domain?: string;
  data?: RegistrationResponse | null;
}) {
  if (!data) return null;

  const registrant = extractRegistrantView(data);
  // Prefer explicit status over source check for better semantics
  const isWhoisUnavailable = data.status === "unknown";

  const serverUrl =
    data.rdapServers && data.rdapServers.length > 0
      ? data.rdapServers[data.rdapServers.length - 1]
      : undefined;
  const serverName = serverUrl
    ? (extractSourceDomain(serverUrl) ?? "RDAP")
    : (data.whoisServer ?? "WHOIS");
  const learnUrl =
    data.source === "rdap"
      ? "https://about.rdap.org/"
      : "https://en.wikipedia.org/wiki/WHOIS";

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
        <div className="flex items-start gap-3 rounded-lg border border-warning-border bg-warning-border/10 p-4 text-sm backdrop-blur-lg dark:bg-warning-border/10">
          <WarningCircleIcon
            className="mt-0.5 size-4 shrink-0 text-yellow-800 dark:text-yellow-200"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              Registration Data Unavailable
            </p>
            <p className="text-yellow-800/90 dark:text-yellow-200/80">
              {data.unavailableReason === "timeout"
                ? "WHOIS/RDAP lookup timed out. This may be a temporary issue with the registry's servers."
                : data.unavailableReason === "unsupported_tld"
                  ? `The .${data.tld} registry does not publish public WHOIS/RDAP data. Registration details cannot be verified for this domain.`
                  : "Registration information could not be retrieved at this time."}
            </p>
          </div>
        </div>
      ) : (
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
              <ResponsiveTooltip>
                <ResponsiveTooltipTrigger
                  nativeButton={false}
                  render={
                    <SealCheckIcon
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
                      title={`Learn about ${data.source === "rdap" ? "RDAP" : "WHOIS"}`}
                      className="text-muted/80"
                    >
                      <GraduationCapIcon className="size-3" />
                    </a>
                  </div>
                </ResponsiveTooltipContent>
              </ResponsiveTooltip>
            }
          />

          <KeyValue
            label="Registrant"
            value={
              data.privacyEnabled || !registrant
                ? "Hidden"
                : formatRegistrant(registrant)
            }
            leading={
              data.privacyEnabled || !registrant ? (
                <DetectiveIcon
                  className="text-muted-foreground"
                  aria-hidden="true"
                />
              ) : undefined
            }
          />

          <KeyValue
            label="Created"
            value={formatDate(data.creationDate || "Unknown")}
            valueTooltip={
              data.creationDate
                ? formatDateTimeUtc(data.creationDate)
                : undefined
            }
            suffix={
              data.creationDate ? (
                <span className="text-[11px] text-muted-foreground leading-none">
                  <RelativeAgeString from={data.creationDate} />
                </span>
              ) : null
            }
          />

          <KeyValue
            label="Expires"
            value={formatDate(data.expirationDate || "Unknown")}
            valueTooltip={
              data.expirationDate
                ? formatDateTimeUtc(data.expirationDate)
                : undefined
            }
            suffix={
              data.expirationDate ? (
                <span className="text-[11px] text-muted-foreground leading-none">
                  <RelativeExpiryString
                    to={data.expirationDate}
                    dangerDays={30}
                    warnDays={45}
                  />
                </span>
              ) : null
            }
          />
        </KeyValueGrid>
      )}
    </ReportSection>
  );
}

export function formatRegistrant(reg: {
  organization: string;
  country: string;
  state?: string;
}) {
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

function extractRegistrantView(
  record: RegistrationResponse,
): RegistrantView | null {
  const registrant = record.contacts?.find((c) => c.type === "registrant");
  if (!registrant) return null;
  const organization =
    (registrant.organization || registrant.name || "").trim() || "Unknown";
  const country = registrant.country || registrant.countryCode || "";
  const state = registrant.state || "" || undefined;
  return { organization, country, state };
}

function extractSourceDomain(
  input: string | undefined | null,
): string | undefined {
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
