"use client";

import type { RefObject } from "react";
import { Favicon } from "@/components/domain/favicon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProviderInfo } from "@/lib/db/repos/tracked-domains";

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
};

/**
 * Shared provider display with tooltip showing DNS records.
 * Used in both grid and table views for consistency.
 */
export function ProviderWithTooltip({
  provider,
  truncationRef,
  isTruncated = false,
  faviconSize = 14,
  className = "",
}: ProviderWithTooltipProps) {
  if (!provider.name) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const hasRecords = provider.records && provider.records.length > 0;

  const content = (
    <div className={`flex min-w-0 items-center gap-1.5 ${className}`}>
      {provider.domain && (
        <Favicon
          domain={provider.domain}
          size={faviconSize}
          className="shrink-0"
        />
      )}
      <span ref={truncationRef} className="truncate text-[13px]">
        {provider.name}
      </span>
    </div>
  );

  // Show DNS records tooltip if available (includes provider info)
  if (hasRecords) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default">{content}</div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-2 py-1">
            {/* Provider info */}
            <div className="flex items-center gap-2 border-border/20 border-b pb-2">
              {provider.domain && (
                <Favicon
                  domain={provider.domain}
                  size={16}
                  className="shrink-0"
                />
              )}
              <span className="font-medium">{provider.name}</span>
            </div>
            {/* DNS records */}
            <div className="space-y-1">
              {provider.records?.map((record) => (
                <div key={record.value} className="font-mono text-xs">
                  {record.priority != null
                    ? `${record.priority} ${record.value}`
                    : record.value}
                </div>
              ))}
            </div>
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
          <div>{content}</div>
        </TooltipTrigger>
        <TooltipContent>{provider.name}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
