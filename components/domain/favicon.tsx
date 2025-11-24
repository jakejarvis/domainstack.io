"use client";

import { useQuery } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

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

  // No need to wait for hydration - if the data was prefetched on the server,
  // it will be available immediately via the dehydrated state
  const { data, isPending } = useQuery(
    trpc.domain.getFavicon.queryOptions(
      { domain },
      {
        // Keep previous data while refetching to prevent flicker
        placeholderData: (prev) => prev,
      },
    ),
  );

  const url = data?.url ?? null;

  // Show skeleton only when truly pending (not when hydrating with prefetched data)
  if (isPending) {
    return (
      <Skeleton
        className={cn("bg-input", className)}
        style={{ ...style, width: size, height: size }}
      />
    );
  }

  if (!url || failedUrl === url) {
    return (
      <Globe
        className={cn("text-muted-foreground", className)}
        width={size}
        height={size}
        style={{ ...style, width: size, height: size }}
        data-favicon={domain}
      />
    );
  }

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
