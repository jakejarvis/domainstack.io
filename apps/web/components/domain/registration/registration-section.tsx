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
import { describeRegistrationSource } from "@/lib/registration-source";
import type { RegistrationResponse } from "@domainstack/types";
import { Alert, AlertDescription, AlertTitle } from "@domainstack/ui/alert";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { formatDate, formatDateTimeUtc, toDateTimeAttr } from "@domainstack/utils/date";
import { describeRegistrant, type RegistrantView } from "@domainstack/utils/registrant";

function getUnavailableMessage(data: RegistrationResponse): string {
  if (data.unavailableReason === "timeout") {
    return "WHOIS/RDAP lookup timed out. This may be a temporary issue with the registry's servers.";
  }
  if (data.unavailableReason === "unsupported_tld") {
    return `The .${data.tld} registry does not publish public WHOIS/RDAP data. Registration details cannot be verified for this domain.`;
  }
  return "Registration information could not be retrieved at this time.";
}

function RegistrationUnavailableNotice({ data }: { data: RegistrationResponse }) {
  return (
    <Alert variant="warning">
      <IconAlertCircle aria-hidden="true" />
      <AlertTitle>Registration Data Unavailable</AlertTitle>
      <AlertDescription>{getUnavailableMessage(data)}</AlertDescription>
    </Alert>
  );
}

function RegistrarVerifiedBy({
  serverUrl,
  serverName,
  learnUrl,
  sourceLabel,
}: ReturnType<typeof describeRegistrationSource>) {
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
            title={`Learn about ${sourceLabel}`}
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
  const registrant = describeRegistrant(data.contacts, data.privacyEnabled);
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
        suffix={<RegistrarVerifiedBy {...describeRegistrationSource(data)} />}
      />

      <RegistrantKeyValue view={registrant} />

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
  const { serverUrl, serverName } = describeRegistrationSource(data);

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

function RegistrantKeyValue({ view }: { view: RegistrantView | null }) {
  const redacted = view?.state === "redacted";
  const named = view?.state === "named";
  const primary = redacted
    ? "Hidden"
    : (view?.name ?? (view?.state === "location-only" ? view.location : undefined)) ||
      "Not published";
  return (
    <KeyValue
      label="Registrant"
      value={primary}
      valueTooltip={
        redacted ? "Registrant details are redacted by the registry or registrar" : undefined
      }
      leading={
        redacted ? <IconSpy className="text-muted-foreground" aria-hidden="true" /> : undefined
      }
      suffix={
        named && view?.location ? (
          <span className="truncate text-[11px] leading-none text-muted-foreground">
            {view.location}
          </span>
        ) : null
      }
    />
  );
}
