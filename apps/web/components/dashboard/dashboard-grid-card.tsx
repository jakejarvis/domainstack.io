import {
  IconAlertCircle,
  IconArchive,
  IconBell,
  IconBellOff,
  IconBookmark,
  IconDotsVertical,
  IconExternalLink,
  IconTool,
  IconTrash,
} from "@tabler/icons-react";
import * as m from "motion/react-m";
import Link from "next/link";
import { memo, useCallback } from "react";

import { DomainHealthBadge, getHealthAccent } from "@/components/dashboard/domain-health-badge";
import { DomainStatusBadge } from "@/components/dashboard/domain-status-badge";
import { ProviderTooltipContent } from "@/components/dashboard/provider-tooltip-content";
import { RelativeExpiryString } from "@/components/domain/relative-expiry";
import { ScreenshotPopover } from "@/components/domain/screenshot-popover";
import { Favicon } from "@/components/icons/favicon";
import { ProviderLogo } from "@/components/icons/provider-logo";
import { useDashboardActions } from "@/context/dashboard-context";
import { useIsDomainSelected, useToggleDomainSelection } from "@/hooks/use-dashboard-selection";
import { useHydratedNow } from "@/hooks/use-hydrated-now";
import { useProviderTooltipData } from "@/hooks/use-provider-tooltip-data";
import { useTruncation } from "@/hooks/use-truncation";
import type { ProviderCategory, ProviderInfo, TrackedDomainWithDetails } from "@domainstack/types";
import { Button } from "@domainstack/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@domainstack/ui/card";
import { Checkbox } from "@domainstack/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@domainstack/ui/dropdown-menu";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@domainstack/ui/responsive-tooltip";
import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";
import { formatDate, formatDateTimeUtc, toDateTimeAttr } from "@domainstack/utils/date";

type DashboardGridCardProps = {
  domain: TrackedDomainWithDetails;
};

function ProviderInfoRows({
  domain,
}: {
  domain: Pick<TrackedDomainWithDetails, "id" | "registrar" | "dns" | "hosting" | "email" | "ca">;
}) {
  return (
    <>
      <InfoRow
        label="Registrar"
        provider={domain.registrar}
        trackedDomainId={domain.id}
        providerType="registrar"
      />
      <InfoRow label="DNS" provider={domain.dns} trackedDomainId={domain.id} providerType="dns" />
      <InfoRow
        label="Hosting"
        provider={domain.hosting}
        trackedDomainId={domain.id}
        providerType="hosting"
      />
      <InfoRow
        label="Email"
        provider={domain.email}
        trackedDomainId={domain.id}
        providerType="email"
      />
      <InfoRow label="CA" provider={domain.ca} trackedDomainId={domain.id} providerType="ca" />
    </>
  );
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
              className="truncate"
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
        <span className="shrink-0 text-[11px] leading-none text-muted-foreground">
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
  onMute,
  onArchive,
  onRemove,
}: {
  domain: TrackedDomainWithDetails;
  selected: boolean;
  isFailing: boolean;
  isPending: boolean;
  onToggleSelect: () => void;
  onVerify: () => void;
  onMute: () => void;
  onArchive: () => void;
  onRemove: () => void;
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
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm">
                <IconDotsVertical />
                <span className="sr-only">Actions</span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-36">
            <DropdownMenuItem
              nativeButton={false}
              render={
                <a href={`https://${domain.domainName}`} target="_blank" rel="noopener noreferrer">
                  <IconExternalLink />
                  Open
                </a>
              }
            />
            <DropdownMenuItem
              nativeButton={false}
              render={
                <Link href={`/${encodeURIComponent(domain.domainName)}`}>
                  <IconBookmark />
                  View Report
                </Link>
              }
            />
            <DropdownMenuSeparator />
            {domain.verified ? (
              <DropdownMenuItem onClick={onMute}>
                {domain.muted ? (
                  <>
                    <IconBell />
                    Unmute
                  </>
                ) : (
                  <>
                    <IconBellOff />
                    Mute
                  </>
                )}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={onArchive}>
              <IconArchive />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRemove}>
              <IconTrash className="text-danger-foreground" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
  const { id: trackedDomainId, verificationMethod, muted } = domain;
  const selected = useIsDomainSelected(trackedDomainId);
  const toggle = useToggleDomainSelection();
  const { onVerify, onRemove, onArchive, onMute, verifyingDomainId } = useDashboardActions();
  const isVerifyPending = verifyingDomainId !== null;
  const isVerifyingThis = verifyingDomainId === trackedDomainId;

  const handleToggleSelect = useCallback(() => {
    toggle(trackedDomainId);
  }, [toggle, trackedDomainId]);

  const handleVerify = useCallback(() => {
    onVerify(trackedDomainId, verificationMethod);
  }, [onVerify, trackedDomainId, verificationMethod]);

  const handleRemove = useCallback(() => {
    onRemove(trackedDomainId);
  }, [onRemove, trackedDomainId]);

  const handleArchive = useCallback(() => {
    onArchive(trackedDomainId);
  }, [onArchive, trackedDomainId]);

  const handleMute = useCallback(() => {
    onMute(trackedDomainId, !muted);
  }, [onMute, trackedDomainId, muted]);

  const now = useHydratedNow();
  const accent = getHealthAccent(domain.expirationDate, domain.verified, now || undefined);
  const isFailing = domain.verified && domain.verificationStatus === "failing";
  const isPending = !domain.verified;

  return (
    <m.div
      className="group relative h-full"
      animate={{ scale: selected ? 1.01 : 1 }}
      transition={{ duration: 0.1 }}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-xl transition-all duration-150",
          selected ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-background" : "ring-0",
        )}
        aria-hidden
      />

      <Card
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-xl border border-black/15 bg-background/60 py-0 shadow-2xl shadow-black/10 dark:border-white/15",
          selected && "bg-primary/10",
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-8 -top-8 h-24 accent-glow opacity-30 blur-2xl"
          style={{ "--glow-color": `var(--accent-${accent})` } as React.CSSProperties}
          suppressHydrationWarning
        />

        <DashboardGridCardHeader
          domain={domain}
          selected={selected}
          isFailing={isFailing}
          isPending={isPending}
          onToggleSelect={handleToggleSelect}
          onVerify={handleVerify}
          onMute={handleMute}
          onArchive={handleArchive}
          onRemove={handleRemove}
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
    </m.div>
  );
});

// Stable fallback for empty provider to avoid creating new object on every render
const EMPTY_PROVIDER: ProviderInfo = { id: null, name: null, domain: null };

function InfoRow({
  label,
  provider,
  children,
  trackedDomainId,
  providerType,
}: {
  label: string;
  provider?: ProviderInfo;
  children?: React.ReactNode;
  trackedDomainId?: string;
  providerType?: ProviderCategory;
}) {
  const { valueRef, isTruncated } = useTruncation();

  // Use stable reference for empty provider
  const effectiveProvider = provider ?? EMPTY_PROVIDER;

  const tooltipData = useProviderTooltipData({
    provider: effectiveProvider,
    trackedDomainId,
    providerType,
  });

  const providerContent = (
    <span className="flex min-w-0 items-center gap-1.5">
      {provider?.id && (
        <ProviderLogo
          providerId={provider.id}
          providerName={provider.name}
          className="size-3.5 shrink-0"
        />
      )}
      <span ref={valueRef} className="min-w-0 flex-1 truncate">
        {provider?.name}
      </span>
    </span>
  );

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-background/40 px-3 py-2 backdrop-blur-lg">
      <span className="flex shrink-0 items-center text-[10px] leading-[1.2] tracking-[0.08em] text-foreground/75 uppercase dark:text-foreground/80">
        {label}
      </span>
      <span className="flex min-w-0 items-center justify-end gap-1.5 text-[13px] leading-[1.2] text-foreground/95">
        {children ||
          (provider?.name ? (
            tooltipData.shouldShowTooltip ? (
              <ResponsiveTooltip open={tooltipData.isOpen} onOpenChange={tooltipData.setIsOpen}>
                <ResponsiveTooltipTrigger nativeButton={false} render={providerContent} />
                <ResponsiveTooltipContent>
                  <ProviderTooltipContent
                    providerId={tooltipData.providerId}
                    providerName={provider.name}
                    providerType={providerType}
                    isLoading={tooltipData.isLoading}
                    records={tooltipData.records}
                    certificateExpiryDate={tooltipData.certificateExpiryDate}
                    whoisServer={tooltipData.whoisServer}
                    rdapServers={tooltipData.rdapServers}
                    registrationSource={tooltipData.registrationSource}
                    transferLock={tooltipData.transferLock}
                    registrantInfo={tooltipData.registrantInfo}
                  />
                </ResponsiveTooltipContent>
              </ResponsiveTooltip>
            ) : isTruncated ? (
              <ResponsiveTooltip>
                <ResponsiveTooltipTrigger nativeButton={false} render={providerContent} />
                <ResponsiveTooltipContent>{provider.name}</ResponsiveTooltipContent>
              </ResponsiveTooltip>
            ) : (
              providerContent
            )
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ))}
      </span>
    </div>
  );
}
