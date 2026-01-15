"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import Image from "next/image";
import { Component, Suspense, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { simpleHash } from "@/lib/simple-hash";
import { cn } from "@/lib/utils";
import type { FaviconWorkflowResult } from "@/workflows/favicon";
import type { ProviderLogoWorkflowResult } from "@/workflows/provider-logo";

/** Union of workflow result types this component can handle */
type IconWorkflowResult = FaviconWorkflowResult | ProviderLogoWorkflowResult;

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
 * Error boundary that catches query failures and renders the fallback icon.
 * This prevents favicon/logo workflow errors from crashing the entire page.
 */
class IconErrorBoundary extends Component<
  { children: React.ReactNode; fallbackProps: FallbackIconProps },
  { hasError: boolean }
> {
  constructor(props: {
    children: React.ReactNode;
    fallbackProps: FallbackIconProps;
  }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <FallbackIcon {...this.props.fallbackProps} />;
    }
    return this.props.children;
  }
}

function SuspendedIcon({
  size = 32,
  className,
  style,
  queryOptions,
  fallbackIdentifier,
  alt,
  dataAttribute,
}: RemoteIconProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const { data: result } = useSuspenseQuery<IconWorkflowResult>({
    ...queryOptions,
    retry: false,
    retryOnMount: false,
  });

  const url = result.data?.url;

  // Query completed: show letter avatar if no icon found or image failed to load
  if (!url || failedUrl === url) {
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

/**
 * Shared component for rendering remote icons (favicons, logos, etc.)
 * with loading states, error handling, and letter avatar fallback.
 */
export function RemoteIcon(props: RemoteIconProps) {
  const { queryOptions: _, ...fallbackProps } = props;
  const { className, style } = props;

  return (
    <IconErrorBoundary fallbackProps={fallbackProps}>
      <Suspense fallback={<IconSkeleton className={className} style={style} />}>
        <SuspendedIcon {...props} />
      </Suspense>
    </IconErrorBoundary>
  );
}
