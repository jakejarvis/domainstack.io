"use client";

import { format } from "date-fns";
import { ExternalLink, MoreVertical, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import {
  DomainHealthBadge,
  getHealthAccent,
} from "@/components/dashboard/domain-health-badge";
import { VerificationBadge } from "@/components/dashboard/verification-badge";
import { Favicon } from "@/components/domain/favicon";
import { RelativeExpiryString } from "@/components/domain/relative-expiry";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  ProviderInfo,
  VerificationStatusType,
} from "@/lib/db/repos/tracked-domains";
import { cn } from "@/lib/utils";

type TrackedDomainCardProps = {
  domainName: string;
  verified: boolean;
  verificationStatus: VerificationStatusType;
  expirationDate: Date | null;
  registrar: ProviderInfo;
  dns: ProviderInfo;
  hosting: ProviderInfo;
  email: ProviderInfo;
  onVerify: () => void;
  onRemove: () => void;
  className?: string;
};

export function TrackedDomainCard({
  domainName,
  verified,
  verificationStatus,
  expirationDate,
  registrar,
  dns,
  hosting,
  email,
  onVerify,
  onRemove,
  className,
}: TrackedDomainCardProps) {
  const accent = getHealthAccent(expirationDate, verified);

  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-3xl border border-black/10 bg-background/60 shadow-2xl shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 dark:border-white/10",
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

      <CardHeader className="relative pb-2">
        <div className="flex items-center gap-3">
          <Favicon domain={domainName} size={32} />
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">{domainName}</CardTitle>
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
              />
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreVertical className="size-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/${domainName}`} className="cursor-pointer">
                  <ExternalLink className="size-4" />
                  View Report
                </Link>
              </DropdownMenuItem>
              {!verified && (
                <DropdownMenuItem onClick={onVerify} className="cursor-pointer">
                  <RefreshCw className="size-4" />
                  Verify Now
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onRemove}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-2 pt-2">
        {verified ? (
          <div className="space-y-2">
            {/* Expires */}
            <InfoRow label="Expires">
              {expirationDate ? (
                <>
                  <span className="truncate">
                    {format(expirationDate, "MMM d, yyyy")}
                  </span>
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
            <InfoRow label="Registrar" provider={registrar} />

            {/* DNS */}
            <InfoRow label="DNS" provider={dns} />

            {/* Hosting */}
            <InfoRow label="Hosting" provider={hosting} />

            {/* Email */}
            <InfoRow label="Email" provider={email} />
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <p className="text-muted-foreground text-sm">
              Complete verification to start receiving expiration alerts.
            </p>
            <Button onClick={onVerify} size="sm" className="w-full">
              <RefreshCw className="size-4" />
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
}: {
  label: string;
  provider?: ProviderInfo;
  children?: React.ReactNode;
}) {
  const hasProvider = provider?.name;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-background/40 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-lg dark:border-white/10">
      <span className="shrink-0 text-[10px] text-foreground/75 uppercase leading-none tracking-[0.08em] dark:text-foreground/80">
        {label}
      </span>
      <span className="flex min-w-0 items-center justify-end gap-1.5 text-[13px] text-foreground/95">
        {children ? (
          children
        ) : hasProvider ? (
          <>
            {provider.domain && (
              <Favicon
                domain={provider.domain}
                size={14}
                className="shrink-0 rounded"
              />
            )}
            <span className="truncate">{provider.name}</span>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </span>
    </div>
  );
}
