"use client";

import {
  AlertCircle,
  BadgeCheck,
  GraduationCap,
  HatGlasses,
} from "lucide-react";
import { Favicon } from "@/components/domain/favicon";
import { KeyValue } from "@/components/domain/key-value";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { RelativeAgeString } from "@/components/domain/relative-age";
import { RelativeExpiryString } from "@/components/domain/relative-expiry";
import { Section } from "@/components/domain/section";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { sections } from "@/lib/constants/sections";
import { formatDate, formatDateTimeUtc } from "@/lib/format";
import type { RegistrationResponse } from "@/lib/schemas";

type RegistrantView = { organization: string; country: string; state?: string };

function VerificationBadge({
  source,
  rdapServers,
  whoisServer,
}: {
  source?: string | null;
  rdapServers?: string[] | null;
  whoisServer?: string | null;
}) {
  if (!source) return null;

  const serverUrl =
    rdapServers && rdapServers.length > 0
      ? rdapServers[rdapServers.length - 1]
      : undefined;
  const serverName = serverUrl
    ? (extractSourceDomain(serverUrl) ?? "RDAP")
    : (whoisServer ?? "WHOIS");
  const learnUrl =
    source === "rdap"
      ? "https://about.rdap.org/"
      : "https://en.wikipedia.org/wiki/WHOIS";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <BadgeCheck className="!h-3.5 !w-3.5 stroke-muted-foreground/80" />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="inline-flex items-center gap-[5px]">
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
            <GraduationCap className="size-3" />
          </a>
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

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

  return (
    <Section {...sections.registration}>
      {isWhoisUnavailable ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning-border bg-warning-border/10 p-4 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur supports-[backdrop-filter]:bg-warning-border/10">
          <AlertCircle className="mt-0.5 size-4 flex-shrink-0 text-yellow-800 dark:text-yellow-200" />
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
              data.registrarProvider?.domain ? (
                <Favicon
                  domain={data.registrarProvider.domain}
                  size={16}
                  className="rounded"
                />
              ) : undefined
            }
            suffix={
              <VerificationBadge
                source={data.source}
                rdapServers={data.rdapServers}
                whoisServer={data.whoisServer}
              />
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
                <HatGlasses className="stroke-muted-foreground" />
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
    </Section>
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

export function extractRegistrantView(
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

export function extractSourceDomain(
  input: string | undefined | null,
): string | undefined {
  if (!input) return undefined;
  const value = String(input).trim();
  if (!value) return undefined;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.hostname || undefined;
  } catch {
    return undefined;
  }
}
