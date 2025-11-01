"use client";

import { useQuery } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

export function Favicon({
  domain,
  size = 16,
  className,
}: {
  domain: string;
  size?: number;
  className?: string;
}) {
  const trpc = useTRPC();
  const [isHydrated, setIsHydrated] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const { data, isPending } = useQuery(
    trpc.domain.favicon.queryOptions(
      { domain },
      {
        enabled: isHydrated,
        placeholderData: (prev) => prev,
      },
    ),
  );

  const url = data?.url ?? null;

  if (!isHydrated || isPending) {
    return (
      <Skeleton
        className={cn("bg-input", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  if (!url || failedUrl === url) {
    return (
      <Globe
        className={cn("text-muted-foreground", className)}
        width={size}
        height={size}
      />
    );
  }

  return (
    <Image
      key={url}
      src={url}
      alt={`${domain} icon`}
      width={size}
      height={size}
      className={className}
      unoptimized
      priority={false}
      draggable={false}
      onError={() => setFailedUrl(url)}
    />
  );
}
