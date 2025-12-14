"use client";

import { format } from "date-fns";
import {
  AlertCircle,
  Archive,
  ExternalLink,
  FileSymlink,
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
import { ProviderWithTooltip } from "@/components/dashboard/provider-with-tooltip";
import { VerificationBadge } from "@/components/dashboard/verification-badge";
import { Favicon } from "@/components/domain/favicon";
import { RelativeExpiryString } from "@/components/domain/relative-expiry";
import { ScreenshotTooltip } from "@/components/domain/screenshot-tooltip";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  ProviderInfo,
  VerificationMethod,
  VerificationStatusType,
} from "@/lib/db/repos/tracked-domains";
import { formatDateTimeUtc } from "@/lib/format";
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
          "-inset-x-8 -top-8 pointer-events-none absolute h-24 opacity-30 blur-2xl",
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
                  "-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 size-5 cursor-pointer",
                  isSelected ? "flex" : "hidden group-hover:flex",
                )}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <ScreenshotTooltip domain={domainName}>
              <Link
                href={`/${domainName}`}
                className="block min-w-0 hover:underline"
              >
                <CardTitle className="truncate text-base">
                  {domainName}
                </CardTitle>
              </Link>
            </ScreenshotTooltip>
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
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="cursor-pointer">
                <MoreVertical className="size-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/${domainName}`} className="cursor-pointer pr-4">
                  <FileSymlink className="size-4" />
                  Open Report
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href={`https://${domainName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer pr-4"
                >
                  <ExternalLink className="size-4" />
                  Open Domain
                </a>
              </DropdownMenuItem>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="truncate">
                        {format(expirationDate, "MMM d, yyyy")}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {formatDateTimeUtc(expirationDate.toISOString())}
                    </TooltipContent>
                  </Tooltip>
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
          </div>
        ) : verified && isFailing ? (
          <>
            <div className="space-y-2">
              {/* Expires */}
              <InfoRow label="Expires">
                {expirationDate ? (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate">
                          {format(expirationDate, "MMM d, yyyy")}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {formatDateTimeUtc(expirationDate.toISOString())}
                      </TooltipContent>
                    </Tooltip>
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
  providerType?: "registrar" | "dns" | "hosting" | "email";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-black/15 bg-background/60 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-lg dark:border-white/15">
      <span className="shrink-0 text-[10px] text-foreground/75 uppercase leading-none tracking-[0.08em] dark:text-foreground/80">
        {label}
      </span>
      <span className="flex min-w-0 items-center justify-end gap-1.5 text-[13px] text-foreground/95">
        {children ||
          (provider && (
            <ProviderWithTooltip
              provider={provider}
              trackedDomainId={trackedDomainId}
              providerType={providerType}
            />
          ))}
      </span>
    </div>
  );
}
