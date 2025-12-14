"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { simpleHash } from "@/lib/simple-hash";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

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

function getEmptyPlaceholder(domain: string) {
  const letter = domain[0]?.toUpperCase() || "?";
  const colorIndex = simpleHash(domain) % PLACEHOLDER_COLORS.length;
  const backgroundColor = PLACEHOLDER_COLORS[colorIndex];
  return { letter, backgroundColor };
}

export function Favicon({
  domain,
  size = 16,
  className,
  style,
}: {
  domain: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const trpc = useTRPC();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Only render data-dependent content after mount to avoid hydration mismatches
  useEffect(() => {
    setMounted(true);
  }, []);

  const { data, isPending } = useQuery(
    trpc.domain.getFavicon.queryOptions(
      { domain },
      {
        // Keep previous data while refetching to prevent flicker
        placeholderData: (prev) => prev,
        // Keep in cache indefinitely during session
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
      },
    ),
  );

  const url = data?.url ?? null;

  // During SSR and initial client render, always show skeleton
  // This ensures server and client HTML match perfectly
  if (!mounted) {
    return (
      <Skeleton
        className={cn("bg-input", className)}
        style={{ ...style, width: size, height: size }}
      />
    );
  }

  // After mount, show skeleton while query is still loading
  if (isPending) {
    return (
      <Skeleton
        className={cn("bg-input", className)}
        style={{ ...style, width: size, height: size }}
      />
    );
  }

  // Query completed: show letter avatar if no favicon found or failed to load
  if (!url || failedUrl === url) {
    const { letter, backgroundColor } = getEmptyPlaceholder(domain);
    const fontSize = Math.max(9, Math.floor(size * 0.55)); // ~55% of container size

    return (
      <div
        className={cn(
          // Use flex (block-level) instead of inline-flex for consistent alignment with <img>
          "pointer-events-none flex select-none items-center justify-center rounded font-bold text-white",
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
        aria-label={`${domain} icon`}
        data-favicon={domain}
      >
        {letter}
      </div>
    );
  }

  // Query completed with URL: show the actual favicon image
  return (
    <Image
      key={url}
      src={url}
      width={size}
      height={size}
      className={className}
      style={{ ...style, width: size, height: size }}
      unoptimized
      priority={false}
      draggable={false}
      onError={() => setFailedUrl(url)}
      alt={`${domain} icon`}
      data-favicon={domain}
    />
  );
}
