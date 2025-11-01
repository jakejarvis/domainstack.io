"use client";

import {
  AlertCircle,
  BadgeCheck,
  GraduationCap,
  HatGlasses,
} from "lucide-react";
import { KeyValue } from "@/components/domain/key-value";
import { KeyValueGrid } from "@/components/domain/key-value-grid";
import { RelativeExpiryString } from "@/components/domain/relative-expiry";
import { Section } from "@/components/domain/section";
import { Favicon } from "@/components/favicon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDate, formatDateTimeUtc } from "@/lib/format";
import type { Registration } from "@/lib/schemas";
import { sections } from "@/lib/sections-meta";

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

export function RegistrationSection({ data }: { data?: Registration | null }) {
  if (!data) return null;

  const registrant = extractRegistrantView(data);
  const isWhoisUnavailable = data.source === null;

  return (
    <Section {...sections.registration}>
      {isWhoisUnavailable ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning-border bg-warning-border/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 flex-shrink-0 text-yellow-800 dark:text-yellow-200" />
          <div className="space-y-1">
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              Registration Data Unavailable
            </p>
            <p className="text-yellow-800/90 dark:text-yellow-200/80">
              The{" "}
              <code className="rounded bg-amber-900/10 px-1 py-0.5 font-mono text-xs dark:bg-amber-100/10">
                .{data.tld}
              </code>{" "}
              registry does not publish public WHOIS/RDAP data. Registration
              details cannot be verified for this domain.
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
  record: Registration,
): RegistrantView | null {
  const registrant = record.contacts?.find((c) => c.type === "registrant");
  if (!registrant) return null;
  const organization =
    (registrant.organization || registrant.name || "").toString().trim() ||
    "Unknown";
  const country = (
    registrant.country ||
    registrant.countryCode ||
    ""
  ).toString();
  const state = (registrant.state || "").toString() || undefined;
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
