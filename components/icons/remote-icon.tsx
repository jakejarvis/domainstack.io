"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { simpleHash } from "@/lib/simple-hash";
import { cn } from "@/lib/utils";
import type { FaviconWorkflowResult } from "@/workflows/favicon";
import type { ProviderLogoWorkflowResult } from "@/workflows/provider-logo";

/** Union of workflow result types this component can handle */
type IconWorkflowResult = FaviconWorkflowResult | ProviderLogoWorkflowResult;

// Deterministic color palette - vibrant but not overwhelming
// Using actual color values to avoid Tailwind purging issues
const PLACEHOLDER_COLORS = [
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ec4899", // pink
  "#f43f5e", // rose
  "#f97316", // orange
  "#f59e0b", // amber
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#d946ef", // fuchsia
] as const;

function getEmptyPlaceholder(identifier: string) {
  const letter = identifier[0]?.toUpperCase() || "?";
  const colorIndex = simpleHash(identifier) % PLACEHOLDER_COLORS.length;
  const backgroundColor = PLACEHOLDER_COLORS[colorIndex];
  return { letter, backgroundColor };
}

export type RemoteIconProps = {
  /**
   * TanStack Query options from tRPC's queryOptions() method.
   * Expected to resolve to FaviconWorkflowResult or ProviderLogoWorkflowResult.
   *
   * Note: Using `any` because tRPC generates complex internal types
   * (UnusedSkipTokenTRPCQueryOptionsOut) that don't conform to standard
   * UseQueryOptions interfaces. Type safety is maintained through the
   * useQuery<IconWorkflowResult> generic parameter.
   */
  // biome-ignore lint/suspicious/noExplicitAny: tRPC queryOptions returns complex internal types
  queryOptions: any;
  /** Identifier for fallback avatar (e.g., domain name, provider name) */
  fallbackIdentifier: string;
  /** Size in pixels (default: 16) */
  size?: number;
  /** Additional CSS classes */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
  /** Alt text for the image */
  alt?: string;
  /** Data attribute for testing/debugging */
  dataAttribute?: string;
};

/**
 * Shared component for rendering remote icons (favicons, logos, etc.)
 * with loading states, error handling, and letter avatar fallback.
 *
 * Note: No explicit hydration gating needed here. React Query's `isPending`
 * state is consistent between SSR and client hydration (both true for
 * unfetched queries), so the Skeleton renders in both cases with no mismatch.
 */
export function RemoteIcon({
  queryOptions,
  fallbackIdentifier,
  size = 32,
  className,
  style,
  alt,
  dataAttribute,
}: RemoteIconProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const {
    data: result,
    isPending,
    isError,
  } = useQuery<IconWorkflowResult>({
    ...queryOptions,
    // Prevent React Query from throwing/logging errors - we handle them gracefully
    throwOnError: false,
    retry: false,
    retryOnMount: false,
  });

  const baseClassName = cn("pointer-events-none size-4 select-none rounded-xs");

  // Show skeleton while query is loading
  // This is consistent between SSR and client hydration (both isPending=true)
  if (isPending) {
    return (
      <Skeleton
        className={cn(baseClassName, "bg-input", className)}
        style={style}
      />
    );
  }

  let url = null;
  if (result?.success && result?.data?.url) {
    // biome-ignore lint/nursery/useDestructuring: might be null
    url = result.data.url;
  }

  // Query completed: show letter avatar if error, no icon found, or failed to load
  if (isError || !url || failedUrl === url) {
    const { letter, backgroundColor } = getEmptyPlaceholder(fallbackIdentifier);
    const fontSize = Math.max(9, Math.floor(size * 0.55)); // ~55% of container size

    return (
      <div
        className={cn(
          baseClassName,
          // Use flex (block-level) instead of inline-flex for consistent alignment with <img>
          "flex items-center justify-center font-bold text-white",
          className,
        )}
        style={{
          ...style,
          fontSize,
          backgroundColor,
        }}
        role="img"
        aria-label={alt ?? `${fallbackIdentifier} icon`}
        {...(dataAttribute ? { [dataAttribute]: fallbackIdentifier } : {})}
      >
        {letter}
      </div>
    );
  }

  // Query completed with URL: show the actual icon image
  return (
    <Image
      key={url}
      src={url}
      width={size}
      height={size}
      className={cn(baseClassName, className)}
      style={style}
      unoptimized
      priority={false}
      draggable={false}
      onError={() => setFailedUrl(url)}
      alt={alt ?? `${fallbackIdentifier} icon`}
      {...(dataAttribute ? { [dataAttribute]: fallbackIdentifier } : {})}
    />
  );
}
