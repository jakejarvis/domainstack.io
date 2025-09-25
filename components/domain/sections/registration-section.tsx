"use client";

import type { DomainRecord } from "rdapper";
import { ErrorWithRetry } from "@/components/domain/error-with-retry";
import { Favicon } from "@/components/domain/favicon";
import { KeyValue } from "@/components/domain/key-value";
import { Section } from "@/components/domain/section";
import { Skeletons } from "@/components/domain/skeletons";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatRegistrant } from "@/lib/format";
import { resolveRegistrarDomain } from "@/lib/providers/detection";
import { SECTION_DEFS } from "./sections-meta";

type RegistrarView = { name: string; domain: string | null };
type RegistrantView = { organization: string; country: string; state?: string };

export function RegistrationSection({
  data,
  isLoading,
  isError,
  onRetry,
}: {
  data?: DomainRecord | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const Def = SECTION_DEFS.registration;
  const registrar: RegistrarView | null = data
    ? {
        name: (data.registrar?.name || "").trim() || "Unknown",
        domain: deriveRegistrarDomain(data),
      }
    : null;
  const registrant: RegistrantView | null = data
    ? extractRegistrantView(data)
    : null;
  return (
    <Section
      title={Def.title}
      description={Def.description}
      help={Def.help}
      icon={<Def.Icon className="h-4 w-4" />}
      accent={Def.accent}
      status={isLoading ? "loading" : isError ? "error" : "ready"}
    >
      {data ? (
        <>
          <KeyValue
            label="Registrar"
            value={registrar?.name || ""}
            leading={
              registrar?.domain ? (
                <Favicon
                  domain={registrar.domain}
                  size={16}
                  className="rounded"
                />
              ) : undefined
            }
            suffix={
              <Badge variant="secondary" title="Data source">
                {data.source ? data.source.toUpperCase() : "RDAP"}
              </Badge>
            }
          />
          <KeyValue
            label="Created"
            value={formatDate(data.creationDate || "")}
          />
          <KeyValue
            label="Expires"
            value={formatDate(data.expirationDate || "")}
          />
          <KeyValue
            label="Registrant"
            value={formatRegistrant(
              registrant ?? { organization: "Unknown", country: "" },
            )}
          />
        </>
      ) : isError ? (
        <ErrorWithRetry message="Failed to load WHOIS." onRetry={onRetry} />
      ) : (
        <Skeletons count={4} />
      )}
    </Section>
  );
}

function deriveRegistrarDomain(record: DomainRecord): string | null {
  const url = record.registrar?.url;
  if (url) {
    try {
      const host = new URL(url).hostname;
      return host || null;
    } catch {}
  }
  return resolveRegistrarDomain(record.registrar?.name || "");
}

function extractRegistrantView(record: DomainRecord): RegistrantView | null {
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
