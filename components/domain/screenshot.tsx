"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleX } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

export function Screenshot({
  domain,
  enabled = true,
  className,
  width = 1200,
  height = 630,
  imageClassName,
  aspectClassName = "aspect-[1200/630]",
}: {
  domain: string;
  enabled?: boolean;
  className?: string;
  width?: number;
  height?: number;
  imageClassName?: string;
  aspectClassName?: string;
}) {
  const trpc = useTRPC();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useQuery(
    trpc.domain.getScreenshot.queryOptions(
      { domain },
      {
        enabled,
        retry: 5,
      },
    ),
  );

  const url = data?.url ?? null;
  const loading = isLoading || isFetching;

  return (
    <div className={className}>
      {url && failedUrl !== url ? (
        <a href={`https://${domain}`} target="_blank" rel="noopener">
          <Image
            key={url}
            src={url}
            alt={`Homepage preview of ${domain}`}
            width={width}
            height={height}
            className={cn(
              "h-auto w-full object-cover",
              aspectClassName,
              imageClassName,
            )}
            unoptimized
            priority={false}
            draggable={false}
            onError={() => setFailedUrl(url)}
          />
        </a>
      ) : (
        <div
          className={`h-auto w-full ${aspectClassName} flex items-center justify-center bg-muted/50`}
        >
          <div
            className="flex items-center gap-2 text-muted-foreground text-xs"
            aria-live="polite"
          >
            {loading ? (
              <>
                <Spinner />
                <span>Taking screenshot...</span>
              </>
            ) : (
              <>
                <CircleX className="h-4 w-4" />
                <span>Unable to take a screenshot.</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
