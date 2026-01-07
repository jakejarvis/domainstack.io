"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { simpleHash } from "@/lib/simple-hash";
import { cn } from "@/lib/utils";
import type { FaviconWorkflowResult } from "@/workflows/favicon";
import type { ProviderLogoWorkflowResult } from "@/workflows/provider-logo";

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
  /** TanStack Query options for fetching the icon */
  // biome-ignore lint/suspicious/noExplicitAny: tRPC query options have complex types that are hard to express
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
  size = 16,
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
  } = useQuery<FaviconWorkflowResult | ProviderLogoWorkflowResult>({
    ...queryOptions,
    // Prevent React Query from throwing/logging errors - we handle them gracefully
    throwOnError: false,
    retry: false,
    retryOnMount: false,
  });

  const baseClassName = "pointer-events-none select-none rounded-xs";

  // Show skeleton while query is loading
  // This is consistent between SSR and client hydration (both isPending=true)
  if (isPending) {
    return (
      <Skeleton
        className={cn(baseClassName, "bg-input", className)}
        style={{ ...style, width: size, height: size }}
      />
    );
  }

  let url = null;
  if (result?.success && result?.data?.url) {
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
          width: size,
          height: size,
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
      style={{ ...style, width: size, height: size }}
      unoptimized
      priority={false}
      draggable={false}
      onError={() => setFailedUrl(url)}
      alt={alt ?? `${fallbackIdentifier} icon`}
      {...(dataAttribute ? { [dataAttribute]: fallbackIdentifier } : {})}
    />
  );
}
