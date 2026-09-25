import { IconLock, IconLockOpen, IconRosetteDiscountCheck, IconSpy } from "@tabler/icons-react";

import { ProviderLogo } from "@/components/icons/provider-logo";
import { describeRegistrationSource } from "@/lib/registration-source";
import type {
  DnsRecord,
  ProviderCategory,
  RegistrationContact,
  RegistrationSource,
} from "@domainstack/types";
import { Spinner } from "@domainstack/ui/spinner";
import { formatDate, toDateTimeAttr } from "@domainstack/utils/date";
import { describeRegistrant } from "@domainstack/utils/registrant";

type ProviderTooltipContentProps = {
  providerId?: string | null;
  providerName: string;
  providerType?: ProviderCategory;
  isLoading: boolean;
  records?: DnsRecord[];
  certificateExpiryDate?: Date | null;
  whoisServer?: string | null;
  rdapServers?: string[] | null;
  registrationSource?: RegistrationSource | null;
  transferLock?: boolean | null;
  registrantInfo?: {
    privacyEnabled: boolean | null;
    contacts: RegistrationContact[] | null;
  };
};

function RegistrantRow({
  registrantInfo,
}: {
  registrantInfo: ProviderTooltipContentProps["registrantInfo"];
}) {
  if (!registrantInfo) return null;
  const view = describeRegistrant(registrantInfo.contacts, registrantInfo.privacyEnabled);
  const isPrivate = !view || view.state === "redacted";
  const summary = [view?.name, view?.location].filter(Boolean).join(" — ");

  return (
    <div className="flex items-center gap-1.5">
      {isPrivate ? (
        <>
          <IconSpy className="size-3.5 text-muted" />
          <span className="text-background/90">Privacy enabled</span>
        </>
      ) : (
        <span className="text-background/90">{summary || "Not published"}</span>
      )}
    </div>
  );
}

function TransferLockRow({ transferLock }: { transferLock?: boolean | null }) {
  if (transferLock === null || transferLock === undefined) return null;

  return (
    <div className="flex items-center gap-1.5">
      {transferLock ? (
        <>
          <IconLock className="size-3.5 text-muted" />
          <span className="text-background/90">Transfer lock is on</span>
        </>
      ) : (
        <>
          <IconLockOpen className="size-3.5 text-amber-300 dark:text-amber-500" />
          <span className="text-background/90">Transfer lock is off</span>
        </>
      )}
    </div>
  );
}

function VerifiedByRow({
  whoisServer,
  rdapServers,
  registrationSource,
}: Pick<ProviderTooltipContentProps, "whoisServer" | "rdapServers" | "registrationSource">) {
  const { serverUrl, serverName, learnUrl, sourceLabel } = describeRegistrationSource({
    whoisServer,
    rdapServers,
    source: registrationSource,
  });

  return (
    <div className="flex items-center gap-1.5">
      <IconRosetteDiscountCheck className="size-3.5 text-green-300 dark:text-green-600" />
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
        </span>{" "}
        <a href={learnUrl} target="_blank" rel="noopener" title={`Learn about ${sourceLabel}`}>
          <span className="text-muted/75">(</span>
          <span className="text-muted/90 underline decoration-dotted underline-offset-2">
            {sourceLabel}
          </span>
          <span className="text-muted/75">)</span>
        </a>
      </span>
    </div>
  );
}

function RegistrarTooltipBody({
  whoisServer,
  rdapServers,
  registrationSource,
  transferLock,
  registrantInfo,
}: Pick<
  ProviderTooltipContentProps,
  "whoisServer" | "rdapServers" | "registrationSource" | "transferLock" | "registrantInfo"
>) {
  if (whoisServer == null && rdapServers == null) {
    return <div className="text-xs text-muted/80">No registration data available</div>;
  }

  return (
    <div className="space-y-1.5 text-xs">
      <RegistrantRow registrantInfo={registrantInfo} />
      <TransferLockRow transferLock={transferLock} />
      <VerifiedByRow
        whoisServer={whoisServer}
        rdapServers={rdapServers}
        registrationSource={registrationSource}
      />
    </div>
  );
}

function CaTooltipBody({ certificateExpiryDate }: { certificateExpiryDate?: Date | null }) {
  if (certificateExpiryDate != null) {
    return (
      <div className="text-xs">
        Expires on{" "}
        <time dateTime={toDateTimeAttr(certificateExpiryDate)} suppressHydrationWarning>
          {formatDate(certificateExpiryDate)}
        </time>
      </div>
    );
  }
  return <div className="text-xs text-muted/80">No certificate data available</div>;
}

function DnsRecordsTooltipBody({ records }: { records?: DnsRecord[] }) {
  if (records && records.length > 0) {
    return (
      <div className="space-y-1">
        {records.map((record) => (
          <div key={record.value} className="font-mono text-xs">
            {record.priority != null ? `${record.priority} ${record.value}` : record.value}
          </div>
        ))}
      </div>
    );
  }
  return <div className="text-xs text-muted/80">No DNS records available</div>;
}

function ProviderTooltipBody(props: ProviderTooltipContentProps) {
  if (props.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-1 text-xs text-muted/90">
        <Spinner className="size-3" />
        <span>Loading…</span>
      </div>
    );
  }

  if (props.providerType === "registrar") {
    return <RegistrarTooltipBody {...props} />;
  }

  if (props.providerType === "ca") {
    return <CaTooltipBody certificateExpiryDate={props.certificateExpiryDate} />;
  }

  return <DnsRecordsTooltipBody records={props.records} />;
}

/**
 * Renders the content inside a provider tooltip.
 * Shows DNS records for DNS/hosting/email providers,
 * certificate expiry for CA providers,
 * registrar verification info for registrars,
 * or loading/empty states.
 */
export function ProviderTooltipContent(props: ProviderTooltipContentProps) {
  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center gap-1.5 border-b border-muted/30 pb-2">
        {props.providerId ? (
          <ProviderLogo
            providerId={props.providerId}
            providerName={props.providerName}
            className="shrink-0"
          />
        ) : null}
        <span className="font-medium">{props.providerName}</span>
      </div>
      <ProviderTooltipBody {...props} />
    </div>
  );
}
