"use client";

import { useQuery } from "@tanstack/react-query";
import { type RefObject, useState } from "react";
import { Favicon } from "@/components/domain/favicon";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  DnsRecordForTooltip,
  ProviderInfo,
} from "@/lib/db/repos/tracked-domains";
import type { ProviderCategory } from "@/lib/schemas";
import { useTRPC } from "@/lib/trpc/client";

type ProviderWithTooltipProps = {
  provider: ProviderInfo;
  /** Optional ref for truncation detection (table view) */
  truncationRef?: RefObject<HTMLSpanElement | null>;
  /** Whether text is truncated (table view) */
  isTruncated?: boolean;
  /** Size of the favicon */
  faviconSize?: number;
  /** Additional classes for the container */
  className?: string;
  /** Tracked domain ID for lazy loading DNS records */
  trackedDomainId?: string;
  /** Provider type for extracting the correct records from domain details */
  providerType?: ProviderCategory;
};

/**
 * Shared provider display with tooltip showing DNS records.
 * Used in both grid and table views for consistency.
 * When trackedDomainId and providerType are provided, fetches DNS records on hover if not already loaded.
 */
export function ProviderWithTooltip({
  provider,
  truncationRef,
  isTruncated = false,
  faviconSize = 14,
  className = "",
  trackedDomainId,
  providerType,
}: ProviderWithTooltipProps) {
  const trpc = useTRPC();
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  const hasRecords = provider.records && provider.records.length > 0;
  // Only lazy-load DNS records for DNS, hosting, and email providers (not registrars or CA)
  const shouldLazyLoad =
    !hasRecords &&
    !!trackedDomainId &&
    !!providerType &&
    providerType !== "registrar" &&
    providerType !== "ca";

  // Lazy load domain details when tooltip opens (only if needed)
  // Always call the hook, but use enabled flag to control when it runs
  const { data: domainDetails, isLoading: isLoadingDetails } = useQuery(
    trpc.tracking.getDomainDetails.queryOptions(
      {
        trackedDomainId: trackedDomainId ?? "",
      },
      {
        enabled: shouldLazyLoad && isTooltipOpen,
        staleTime: 60_000, // Cache for 1 minute
      },
    ),
  );

  // Early return AFTER all hooks have been called
  if (!provider.name) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  // Extract records from lazy-loaded details based on provider type
  let lazyLoadedRecords: DnsRecordForTooltip[] | undefined;
  if (domainDetails && providerType) {
    lazyLoadedRecords = domainDetails[providerType]?.records;
  }

  const displayRecords = provider.records ?? lazyLoadedRecords;
  const hasDisplayRecords = displayRecords && displayRecords.length > 0;

  const content = (
    <div className={`flex min-w-0 items-center gap-1.5 ${className}`}>
      {provider.domain && (
        <Favicon
          domain={provider.domain}
          size={faviconSize}
          className="shrink-0 rounded"
        />
      )}
      <span ref={truncationRef} className="truncate text-[13px]">
        {provider.name}
      </span>
    </div>
  );

  // Show DNS records tooltip if available or if we should lazy load them
  if (hasDisplayRecords || shouldLazyLoad) {
    return (
      <Tooltip open={isTooltipOpen} onOpenChange={setIsTooltipOpen}>
        <TooltipTrigger asChild>
          <span>{content}</span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-2 py-1">
            {/* Provider info */}
            <div className="flex items-center gap-2 border-border/20 border-b pb-2">
              {provider.domain && (
                <Favicon
                  domain={provider.domain}
                  size={16}
                  className="shrink-0 rounded"
                />
              )}
              <span className="font-medium">{provider.name}</span>
            </div>
            {/* DNS records */}
            {isLoadingDetails ? (
              <div className="flex items-center justify-center gap-2 py-1 text-muted/90 text-xs">
                <Spinner className="size-3" />
                <span>Loading records…</span>
              </div>
            ) : hasDisplayRecords ? (
              <div className="space-y-1">
                {displayRecords.map((record) => (
                  <div key={record.value} className="font-mono text-xs">
                    {record.priority != null
                      ? `${record.priority} ${record.value}`
                      : record.value}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-1 text-muted/80 text-xs">
                No DNS records available
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Show truncation tooltip if text is truncated (fallback when no records)
  if (isTruncated) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{content}</span>
        </TooltipTrigger>
        <TooltipContent>{provider.name}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
