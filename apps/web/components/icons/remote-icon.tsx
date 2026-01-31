"use client";

import { Skeleton } from "@domainstack/ui/skeleton";
import { cn } from "@domainstack/ui/utils";
import { simpleHash } from "@domainstack/utils";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useState } from "react";

/**
 * Result shape for icon queries (favicons, provider logos).
 * Both the tRPC queries and provider-logo workflow return this shape.
 */
type IconQueryResult = {
  success: boolean;
  data: { url: string | null } | null;
};

export type RemoteIconProps = {
  /**
   * TanStack Query options from tRPC's queryOptions() method.
   * Expected to resolve to a result with { data: { url: string | null } }.
   *
   * Note: Using `any` because tRPC generates complex internal types
   * (UnusedSkipTokenTRPCQueryOptionsOut) that don't conform to standard
   * UseQueryOptions interfaces. Type safety is maintained through the
   * useQuery<IconQueryResult> generic parameter.
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

const baseClassName = cn("pointer-events-none size-4 select-none rounded-xs");

function IconSkeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Skeleton
      className={cn(baseClassName, "bg-input", className)}
      style={style}
    />
  );
}

type FallbackIconProps = Omit<RemoteIconProps, "queryOptions">;

function FallbackIcon({
  size = 32,
  className,
  style,
  fallbackIdentifier,
  alt,
  dataAttribute,
}: FallbackIconProps) {
  const letter = fallbackIdentifier[0]?.toUpperCase() || "?";
  const backgroundColor =
    PLACEHOLDER_COLORS[
      simpleHash(fallbackIdentifier) % PLACEHOLDER_COLORS.length
    ];
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

/**
 * Shared component for rendering remote icons (favicons, logos, etc.)
 * with loading states, error handling, and letter avatar fallback.
 */
export function RemoteIcon({
  size = 32,
  className,
  style,
  queryOptions,
  fallbackIdentifier,
  alt,
  dataAttribute,
}: RemoteIconProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const {
    data: result,
    isLoading,
    isError,
  } = useQuery<IconQueryResult>({
    ...queryOptions,
    // Disable retries - icons should fail fast to fallback
    retry: false,
    retryOnMount: false,
    // Disable refetching - icons don't need continuous revalidation
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Loading state: show skeleton
  if (isLoading) {
    return <IconSkeleton className={className} style={style} />;
  }

  const url = result?.data?.url;

  // Error or no URL: show letter avatar fallback
  if (isError || !url || failedUrl === url) {
    return (
      <FallbackIcon
        size={size}
        className={className}
        style={style}
        fallbackIdentifier={fallbackIdentifier}
        alt={alt}
        dataAttribute={dataAttribute}
      />
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
      alt={alt ?? `${fallbackIdentifier} icon`}
      onError={() => setFailedUrl(url)}
      {...(dataAttribute ? { [dataAttribute]: fallbackIdentifier } : {})}
    />
  );
}
