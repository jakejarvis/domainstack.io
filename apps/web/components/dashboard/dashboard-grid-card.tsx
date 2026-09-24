import { IconAlertCircle, IconTool } from "@tabler/icons-react";
import Link from "next/link";
import { memo, useCallback } from "react";

import { DomainActionsMenu } from "@/components/dashboard/domain-actions-menu";
import { DomainHealthBadge, getHealthAccent } from "@/components/dashboard/domain-health-badge";
import { DomainStatusBadge } from "@/components/dashboard/domain-status-badge";
import { ProviderCell } from "@/components/dashboard/provider-cell";
import { RelativeExpiryString } from "@/components/domain/relative-expiry";
import { ScreenshotPopover } from "@/components/domain/screenshot-popover";
import { Favicon } from "@/components/icons/favicon";
import { useDashboardActions } from "@/context/dashboard-context";
import { useIsDomainSelected, useToggleDomainSelection } from "@/hooks/use-dashboard-selection";
import { useHydratedNow } from "@/hooks/use-hydrated-now";
import type { ProviderCategory, TrackedDomainWithDetails } from "@domainstack/types";
import { Button } from "@domainstack/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@domainstack/ui/card";
import { Checkbox } from "@domainstack/ui/checkbox";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";
import { formatDate, formatDateTimeUtc, toDateTimeAttr } from "@domainstack/utils/date";

const GLOW_CLASSES: Record<ReturnType<typeof getHealthAccent>, string> = {
  green: "glow-accent-green/15",
  orange: "glow-accent-orange/15",
  red: "glow-accent-red/15",
  slate: "glow-accent-slate/15",
};

type DashboardGridCardProps = {
  domain: TrackedDomainWithDetails;
};

const PROVIDER_ROWS = [
  { label: "Registrar", type: "registrar" },
  { label: "DNS", type: "dns" },
  { label: "Hosting", type: "hosting" },
  { label: "Email", type: "email" },
  { label: "CA", type: "ca" },
] as const satisfies readonly { label: string; type: ProviderCategory }[];

function ProviderInfoRows({
  domain,
}: {
  domain: Pick<TrackedDomainWithDetails, "id" | ProviderCategory>;
}) {
  return PROVIDER_ROWS.map(({ label, type }) => (
    <InfoRow key={type} label={label}>
      <ProviderCell
        provider={domain[type]}
        trackedDomainId={domain.id}
        providerType={type}
        logoClassName="size-3.5"
      />
    </InfoRow>
  ));
}

function ExpiresInfoRow({
  expirationDate,
  showRelative,
}: {
  expirationDate: Date | null;
  showRelative: boolean;
}) {
  if (!expirationDate) {
    return (
      <InfoRow label="Expires">
        <span className="text-muted-foreground">Unknown</span>
      </InfoRow>
    );
  }

  return (
    <InfoRow label="Expires">
      <ResponsiveTooltip>
        <ResponsiveTooltipTrigger
          nativeButton={false}
          render={
            <time
              className="truncate tabular-nums"
              dateTime={toDateTimeAttr(expirationDate)}
              suppressHydrationWarning
            >
              {formatDate(expirationDate)}
            </time>
          }
        />
        <ResponsiveTooltipContent>
          <time dateTime={toDateTimeAttr(expirationDate)} suppressHydrationWarning>
            {formatDateTimeUtc(expirationDate)}
          </time>
        </ResponsiveTooltipContent>
      </ResponsiveTooltip>
      {showRelative ? (
        <span className="shrink-0 text-[11px] leading-none text-muted-foreground tabular-nums">
          <RelativeExpiryString to={expirationDate} dangerDays={30} warnDays={45} />
        </span>
      ) : null}
    </InfoRow>
  );
}

function DashboardGridCardBody({
  domain,
  isFailing,
  isVerifyPending,
  isVerifyingThis,
  onVerify,
}: {
  domain: TrackedDomainWithDetails;
  isFailing: boolean;
  isVerifyPending: boolean;
  isVerifyingThis: boolean;
  onVerify: () => void;
}) {
  if (domain.verified && !isFailing) {
    return (
      <div className="space-y-2">
        <ExpiresInfoRow expirationDate={domain.expirationDate} showRelative={false} />
        <ProviderInfoRows domain={domain} />
      </div>
    );
  }

  if (domain.verified && isFailing) {
    return (
      <>
        <div className="space-y-2">
          <ExpiresInfoRow expirationDate={domain.expirationDate} showRelative />
          <ProviderInfoRows domain={domain} />
        </div>
        <div className="min-h-4 flex-1" />
        <Button onClick={onVerify} disabled={isVerifyPending} className="mt-3 w-full">
          {isVerifyingThis ? <Spinner /> : <IconTool />}
          Fix Verification
        </Button>
      </>
    );
  }

  return (
    <div className="flex flex-1 flex-col pt-2">
      <p className="text-sm text-muted-foreground">
        Complete verification to start receiving health alerts.
      </p>
      <div className="min-h-4 flex-1" />
      <Button onClick={onVerify} disabled={isVerifyPending} className="w-full">
        {isVerifyingThis ? <Spinner /> : <IconAlertCircle />}
        Complete Verification
      </Button>
    </div>
  );
}

function DashboardGridCardHeader({
  domain,
  selected,
  isFailing,
  isPending,
  onToggleSelect,
  onVerify,
}: {
  domain: TrackedDomainWithDetails;
  selected: boolean;
  isFailing: boolean;
  isPending: boolean;
  onToggleSelect: () => void;
  onVerify: () => void;
}) {
  return (
    <CardHeader className="relative pt-6 pb-2">
      <div className="flex items-center gap-3">
        <div className="relative size-8 shrink-0">
          <Favicon
            domain={domain.domainName}
            className={cn("size-8 rounded-md", selected ? "hidden" : "group-hover:hidden")}
          />
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select ${domain.domainName}`}
            className={cn(
              "absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2",
              selected ? "flex" : "hidden group-hover:flex",
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <ScreenshotPopover domain={domain.domainName} domainId={domain.domainId}>
            <Link
              href={`/${encodeURIComponent(domain.domainName)}`}
              className="block min-w-0 hover:underline"
              data-disable-progress
            >
              <CardTitle className="truncate text-base">{domain.domainName}</CardTitle>
            </Link>
          </ScreenshotPopover>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {domain.verified ? (
              <DomainHealthBadge
                expirationDate={domain.expirationDate}
                verified={domain.verified}
              />
            ) : null}
            <DomainStatusBadge
              verified={domain.verified}
              verificationStatus={domain.verificationStatus}
              verificationMethod={domain.verificationMethod}
              verificationFailedAt={domain.verificationFailedAt}
              onClick={isFailing || isPending ? onVerify : undefined}
            />
          </div>
        </div>
        <DomainActionsMenu domain={domain} triggerVariant="ghost" />
      </div>
    </CardHeader>
  );
}

/**
 * Memoized grid card that handles its own selection state, actions, and selection visuals.
 * Includes scale animation and selection ring. Parent handles enter/exit animations.
 */
export const DashboardGridCard = memo(function DashboardGridCard({
  domain,
}: DashboardGridCardProps) {
  const { id: trackedDomainId, verificationMethod } = domain;
  const selected = useIsDomainSelected(trackedDomainId);
  const toggle = useToggleDomainSelection();
  const { onVerify, verifyingDomainId } = useDashboardActions();
  const isVerifyPending = verifyingDomainId !== null;
  const isVerifyingThis = verifyingDomainId === trackedDomainId;

  const handleToggleSelect = useCallback(() => {
    toggle(trackedDomainId);
  }, [toggle, trackedDomainId]);

  const handleVerify = useCallback(() => {
    onVerify(trackedDomainId, verificationMethod);
  }, [onVerify, trackedDomainId, verificationMethod]);

  const now = useHydratedNow();
  const accent = getHealthAccent(domain.expirationDate, domain.verified, now || undefined);
  const isFailing = domain.verified && domain.verificationStatus === "failing";
  const isPending = !domain.verified;

  return (
    <div
      className={cn(
        "group relative h-full transition-transform duration-100",
        selected && "scale-[1.01]",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-xl transition duration-150",
          selected ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-background" : "ring-0",
        )}
        aria-hidden
      />

      <Card className="relative flex h-full flex-col overflow-hidden py-0">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -inset-x-20 -top-20 h-52",
            GLOW_CLASSES[accent],
          )}
          suppressHydrationWarning
        />

        <DashboardGridCardHeader
          domain={domain}
          selected={selected}
          isFailing={isFailing}
          isPending={isPending}
          onToggleSelect={handleToggleSelect}
          onVerify={handleVerify}
        />

        <CardContent className="relative flex flex-1 flex-col pt-2 pb-6">
          <DashboardGridCardBody
            domain={domain}
            isFailing={isFailing}
            isVerifyPending={isVerifyPending}
            isVerifyingThis={isVerifyingThis}
            onVerify={handleVerify}
          />
        </CardContent>
      </Card>
    </div>
  );
});

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/60 px-3 py-2">
      <span className="flex shrink-0 items-center text-[10px] leading-[1.2] tracking-[0.08em] text-foreground/75 uppercase dark:text-foreground/80">
        {label}
      </span>
      <span className="flex min-w-0 items-center justify-end gap-1.5 text-[13px] leading-[1.2] text-foreground/95">
        {children}
      </span>
    </div>
  );
}
