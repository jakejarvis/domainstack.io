"use client";

import { format } from "date-fns";
import {
  AlertCircle,
  Archive,
  BookMarked,
  ExternalLink,
  MoreVertical,
  Trash2,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DomainHealthBadge,
  getHealthAccent,
} from "@/components/dashboard/domain-health-badge";
import { ProviderTooltipContent } from "@/components/dashboard/provider-tooltip-content";
import { VerificationBadge } from "@/components/dashboard/verification-badge";
import { Favicon } from "@/components/domain/favicon";
import { RelativeExpiryString } from "@/components/domain/relative-expiry";
import { ScreenshotPopover } from "@/components/domain/screenshot-popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResponsiveTooltip,
  ResponsiveTooltipContent,
  ResponsiveTooltipTrigger,
} from "@/components/ui/responsive-tooltip";
import { useProviderTooltipData } from "@/hooks/use-provider-tooltip-data";
import { useTruncation } from "@/hooks/use-truncation";
import type {
  ProviderInfo,
  VerificationMethod,
  VerificationStatusType,
} from "@/lib/db/repos/tracked-domains";
import { formatDateTimeUtc } from "@/lib/format";
import type { ProviderCategory } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type TrackedDomainCardProps = {
  trackedDomainId: string;
  domainName: string;
  verified: boolean;
  verificationStatus: VerificationStatusType;
  verificationMethod: VerificationMethod | null;
  verificationFailedAt?: Date | null;
  expirationDate: Date | null;
  registrar: ProviderInfo;
  dns: ProviderInfo;
  hosting: ProviderInfo;
  email: ProviderInfo;
  ca: ProviderInfo;
  onVerify: () => void;
  onRemove: () => void;
  onArchive?: () => void;
  className?: string;
  // Selection props - when provided, enables checkbox functionality
  isSelected?: boolean;
  onToggleSelect?: () => void;
};

export function TrackedDomainCard({
  trackedDomainId,
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
  onVerify,
  onRemove,
  onArchive,
  className,
  isSelected = false,
  onToggleSelect,
}: TrackedDomainCardProps) {
  // Capture current time only on client after mount (not during SSR)
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  const accent = getHealthAccent(expirationDate, verified, now || undefined);
  const isFailing = verified && verificationStatus === "failing";
  const isPending = !verified;

  return (
    <Card
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-xl border border-black/15 bg-background/60 py-0 shadow-2xl shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 dark:border-white/15",
        className,
      )}
      data-accent={accent}
    >
      {/* Accent glow */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-x-8 -top-8 h-24 opacity-30 blur-2xl",
          "accent-glow",
        )}
      />

      <CardHeader className="relative pt-6 pb-2">
        <div className="flex items-center gap-3">
          <div className="relative size-8 shrink-0">
            {/* Favicon - hidden on hover or when selected (only if selection is enabled) */}
            <Favicon
              domain={domainName}
              size={32}
              className={cn(
                onToggleSelect &&
                  (isSelected ? "hidden" : "group-hover:hidden"),
              )}
            />
            {/* Checkbox - shown on hover or when selected (only if selection is enabled) */}
            {onToggleSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelect}
                aria-label={`Select ${domainName}`}
                className={cn(
                  "absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 cursor-pointer",
                  isSelected ? "flex" : "hidden group-hover:flex",
                )}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <ScreenshotPopover domain={domainName}>
              <Link
                href={`/${encodeURIComponent(domainName)}`}
                prefetch={false}
                className="block min-w-0 hover:underline"
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
              <VerificationBadge
                verified={verified}
                verificationStatus={verificationStatus}
                verificationMethod={verificationMethod}
                verificationFailedAt={verificationFailedAt}
                onClick={isFailing || isPending ? onVerify : undefined}
              />
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer"
                >
                  <MoreVertical className="size-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                nativeButton={false}
                render={
                  <a
                    href={`https://${domainName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer pr-4"
                  >
                    <ExternalLink className="size-4" />
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
                    className="cursor-pointer pr-4"
                  >
                    <BookMarked className="size-4" />
                    View Report
                  </Link>
                }
              />
              {onArchive && (
                <DropdownMenuItem
                  onClick={onArchive}
                  className="cursor-pointer pr-4"
                >
                  <Archive className="size-4" />
                  Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onRemove}
                className="cursor-pointer pr-4"
              >
                <Trash2 className="size-3.5 text-danger-foreground" />
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
            <Button onClick={onVerify} className="mt-3 w-full cursor-pointer">
              <Wrench className="size-4" />
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
            <Button onClick={onVerify} className="w-full cursor-pointer">
              <AlertCircle className="size-4" />
              Complete Verification
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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

  const tooltipData = useProviderTooltipData({
    provider: provider ?? { id: null, name: null, domain: null },
    trackedDomainId,
    providerType,
  });

  const providerContent = (
    <span className="flex min-w-0 items-center gap-1.5">
      {provider?.domain && (
        <Favicon
          domain={provider.domain}
          size={14}
          className="shrink-0 rounded"
        />
      )}
      <span ref={valueRef} className="min-w-0 flex-1 truncate">
        {provider?.name}
      </span>
    </span>
  );

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-black/15 bg-background/60 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-lg dark:border-white/15">
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
                    providerName={provider.name}
                    providerDomain={provider.domain}
                    providerType={providerType}
                    isLoading={tooltipData.isLoading}
                    records={tooltipData.records}
                    certificateExpiryDate={tooltipData.certificateExpiryDate}
                    whoisServer={tooltipData.whoisServer}
                    rdapServers={tooltipData.rdapServers}
                    registrationSource={tooltipData.registrationSource}
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
