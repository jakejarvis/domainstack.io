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
import { format } from "date-fns";
import { motion } from "motion/react";
import Link from "next/link";
import { memo, useCallback } from "react";
import {
  DomainHealthBadge,
  getHealthAccent,
} from "@/components/dashboard/domain-health-badge";
import { DomainStatusBadge } from "@/components/dashboard/domain-status-badge";
import { ProviderTooltipContent } from "@/components/dashboard/provider-tooltip-content";
import { RelativeExpiryString } from "@/components/domain/relative-expiry";
import { ScreenshotPopover } from "@/components/domain/screenshot-popover";
import { Favicon } from "@/components/icons/favicon";
import { ProviderLogo } from "@/components/icons/provider-logo";
import {
  useDashboardActions,
  useDashboardSelection,
} from "@/context/dashboard-context";
import { useHydratedNow } from "@/hooks/use-hydrated-now";
import { useProviderTooltipData } from "@/hooks/use-provider-tooltip-data";
import { useTruncation } from "@/hooks/use-truncation";
import type { ProviderCategory } from "@/lib/constants/providers";
import type {
  VerificationMethod,
  VerificationStatus,
} from "@/lib/constants/verification";
import { formatDateTimeUtc } from "@/lib/format";
import type { ProviderInfo } from "@/lib/types/provider";
import { cn } from "@/lib/utils";

type DashboardGridCardProps = {
  trackedDomainId: string;
  domainId: string;
  domainName: string;
  verified: boolean;
  verificationStatus: VerificationStatus;
  verificationMethod: VerificationMethod | null;
  verificationFailedAt?: Date | null;
  expirationDate: Date | null;
  registrar: ProviderInfo;
  dns: ProviderInfo;
  hosting: ProviderInfo;
  email: ProviderInfo;
  ca: ProviderInfo;
  muted: boolean;
};

/**
 * Memoized grid card that handles its own selection state, actions, and selection visuals.
 * Includes scale animation and selection ring. Parent handles enter/exit animations.
 */
export const DashboardGridCard = memo(function DashboardGridCard({
  trackedDomainId,
  domainId,
  domainName,
  verified,
  verificationStatus,
  verificationMethod,
  verificationFailedAt,
  expirationDate,
  registrar,
  dns,
  hosting,
  email,
  ca,
  muted,
}: DashboardGridCardProps) {
  // Selection state and actions from context
  const { isSelected, toggle } = useDashboardSelection();
  const { onVerify, onRemove, onArchive, onToggleMuted } =
    useDashboardActions();

  const selected = isSelected(trackedDomainId);

  // Create stable callbacks
  const handleToggleSelect = useCallback(() => {
    toggle(trackedDomainId);
  }, [toggle, trackedDomainId]);

  const handleVerify = useCallback(() => {
    onVerify(trackedDomainId, verificationMethod);
  }, [onVerify, trackedDomainId, verificationMethod]);

  const handleRemove = useCallback(() => {
    onRemove(trackedDomainId, domainName);
  }, [onRemove, trackedDomainId, domainName]);

  const handleArchive = useCallback(() => {
    onArchive(trackedDomainId, domainName);
  }, [onArchive, trackedDomainId, domainName]);

  const handleToggleMuted = useCallback(() => {
    onToggleMuted(trackedDomainId, !muted);
  }, [onToggleMuted, trackedDomainId, muted]);

  // Use shared hydrated time to avoid N separate useEffect calls for N cards
  const now = useHydratedNow();

  const accent = getHealthAccent(expirationDate, verified, now || undefined);
  const isFailing = verified && verificationStatus === "failing";
  const isPending = !verified;

  return (
    <motion.div
      className="group relative h-full"
      animate={{ scale: selected ? 1.01 : 1 }}
      transition={{ duration: 0.1 }}
    >
      {/* Selection ring overlay */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-xl transition-all duration-150",
          selected
            ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-background"
            : "ring-0",
        )}
        aria-hidden
      />

      <Card
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-xl border border-black/15 bg-background/60 py-0 shadow-2xl shadow-black/10 dark:border-white/15",
          selected && "bg-primary/10",
        )}
      >
        {/* Accent glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-8 -top-8 h-24 accent-glow opacity-30 blur-2xl"
          style={
            { "--glow-color": `var(--accent-${accent})` } as React.CSSProperties
          }
        />

        <CardHeader className="relative pt-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="relative size-8 shrink-0">
              {/* Favicon - hidden on hover or when selected */}
              <Favicon
                domain={domainName}
                className={cn(
                  "size-8 rounded-md",
                  selected ? "hidden" : "group-hover:hidden",
                )}
              />
              {/* Checkbox - shown on hover or when selected */}
              <Checkbox
                checked={selected}
                onCheckedChange={handleToggleSelect}
                aria-label={`Select ${domainName}`}
                className={cn(
                  "absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2",
                  selected ? "flex" : "hidden group-hover:flex",
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <ScreenshotPopover domain={domainName} domainId={domainId}>
                <Link
                  href={`/${encodeURIComponent(domainName)}`}
                  prefetch={false}
                  className="block min-w-0 hover:underline"
                  data-disable-progress
                >
                  <CardTitle className="truncate text-base">
                    {domainName}
                  </CardTitle>
                </Link>
              </ScreenshotPopover>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {verified && (
                  <DomainHealthBadge
                    expirationDate={expirationDate}
                    verified={verified}
                  />
                )}
                <DomainStatusBadge
                  verified={verified}
                  verificationStatus={verificationStatus}
                  verificationMethod={verificationMethod}
                  verificationFailedAt={verificationFailedAt}
                  onClick={isFailing || isPending ? handleVerify : undefined}
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
                    <a
                      href={`https://${domainName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <IconExternalLink />
                      Open
                    </a>
                  }
                />
                <DropdownMenuItem
                  nativeButton={false}
                  render={
                    <Link
                      href={`/${encodeURIComponent(domainName)}`}
                      prefetch={false}
                    >
                      <IconBookmark />
                      View Report
                    </Link>
                  }
                />
                <DropdownMenuSeparator />
                {verified && (
                  <DropdownMenuItem onClick={handleToggleMuted}>
                    {muted ? (
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
                )}
                <DropdownMenuItem onClick={handleArchive}>
                  <IconArchive />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRemove}>
                  <IconTrash className="text-danger-foreground" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="relative flex flex-1 flex-col pt-2 pb-6">
          {verified && !isFailing ? (
            <div className="space-y-2">
              {/* Expires */}
              <InfoRow label="Expires">
                {expirationDate ? (
                  <ResponsiveTooltip>
                    <ResponsiveTooltipTrigger
                      render={
                        <span className="truncate">
                          {format(expirationDate, "MMM d, yyyy")}
                        </span>
                      }
                    />
                    <ResponsiveTooltipContent>
                      {formatDateTimeUtc(expirationDate.toISOString())}
                    </ResponsiveTooltipContent>
                  </ResponsiveTooltip>
                ) : (
                  <span className="text-muted-foreground">Unknown</span>
                )}
              </InfoRow>

              {/* Registrar */}
              <InfoRow
                label="Registrar"
                provider={registrar}
                trackedDomainId={trackedDomainId}
                providerType="registrar"
              />

              {/* DNS */}
              <InfoRow
                label="DNS"
                provider={dns}
                trackedDomainId={trackedDomainId}
                providerType="dns"
              />

              {/* Hosting */}
              <InfoRow
                label="Hosting"
                provider={hosting}
                trackedDomainId={trackedDomainId}
                providerType="hosting"
              />

              {/* Email */}
              <InfoRow
                label="Email"
                provider={email}
                trackedDomainId={trackedDomainId}
                providerType="email"
              />

              {/* CA */}
              <InfoRow
                label="CA"
                provider={ca}
                trackedDomainId={trackedDomainId}
                providerType="ca"
              />
            </div>
          ) : verified && isFailing ? (
            <>
              <div className="space-y-2">
                {/* Expires */}
                <InfoRow label="Expires">
                  {expirationDate ? (
                    <>
                      <ResponsiveTooltip>
                        <ResponsiveTooltipTrigger
                          render={
                            <span className="truncate">
                              {format(expirationDate, "MMM d, yyyy")}
                            </span>
                          }
                        />
                        <ResponsiveTooltipContent>
                          {formatDateTimeUtc(expirationDate.toISOString())}
                        </ResponsiveTooltipContent>
                      </ResponsiveTooltip>
                      <span className="shrink-0 text-[11px] text-muted-foreground leading-none">
                        <RelativeExpiryString
                          to={expirationDate}
                          dangerDays={30}
                          warnDays={45}
                        />
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Unknown</span>
                  )}
                </InfoRow>

                {/* Registrar */}
                <InfoRow
                  label="Registrar"
                  provider={registrar}
                  trackedDomainId={trackedDomainId}
                  providerType="registrar"
                />

                {/* DNS */}
                <InfoRow
                  label="DNS"
                  provider={dns}
                  trackedDomainId={trackedDomainId}
                  providerType="dns"
                />

                {/* Hosting */}
                <InfoRow
                  label="Hosting"
                  provider={hosting}
                  trackedDomainId={trackedDomainId}
                  providerType="hosting"
                />

                {/* Email */}
                <InfoRow
                  label="Email"
                  provider={email}
                  trackedDomainId={trackedDomainId}
                  providerType="email"
                />

                {/* CA */}
                <InfoRow
                  label="CA"
                  provider={ca}
                  trackedDomainId={trackedDomainId}
                  providerType="ca"
                />
              </div>
              {/* Spacer to ensure minimum gap above button */}
              <div className="min-h-4 flex-1" />
              <Button onClick={handleVerify} className="mt-3 w-full">
                <IconTool />
                Fix Verification
              </Button>
            </>
          ) : (
            <div className="flex flex-1 flex-col pt-2">
              <p className="text-muted-foreground text-sm">
                Complete verification to start receiving health alerts.
              </p>
              {/* Spacer to ensure minimum gap above button */}
              <div className="min-h-4 flex-1" />
              <Button onClick={handleVerify} className="w-full">
                <IconAlertCircle />
                Complete Verification
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
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
      <span className="flex shrink-0 items-center text-[10px] text-foreground/75 uppercase leading-[1.2] tracking-[0.08em] dark:text-foreground/80">
        {label}
      </span>
      <span className="flex min-w-0 items-center justify-end gap-1.5 text-[13px] text-foreground/95 leading-[1.2]">
        {children ||
          (provider?.name ? (
            tooltipData.shouldShowTooltip ? (
              <ResponsiveTooltip
                open={tooltipData.isOpen}
                onOpenChange={tooltipData.setIsOpen}
              >
                <ResponsiveTooltipTrigger render={providerContent} />
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
                <ResponsiveTooltipTrigger render={providerContent} />
                <ResponsiveTooltipContent>
                  {provider.name}
                </ResponsiveTooltipContent>
              </ResponsiveTooltip>
            ) : (
              providerContent
            )
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ))}
      </span>
    </div>
  );
}
