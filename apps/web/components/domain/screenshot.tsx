"use client";

import { ShieldWarningIcon, XCircleIcon } from "@phosphor-icons/react/ssr";
import Image from "next/image";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useScreenshot } from "@/hooks/use-screenshot";
import { cn } from "@/lib/utils";

export function Screenshot({
  domain,
  domainId,
  enabled = true,
  className,
  width = 1200,
  height = 630,
  imageClassName,
  aspectClassName = "aspect-[1200/630]",
}: {
  domain: string;
  domainId?: string;
  enabled?: boolean;
  className?: string;
  width?: number;
  height?: number;
  imageClassName?: string;
  aspectClassName?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const { url, blocked, isLoading } = useScreenshot({
    domainId,
    domain,
    enabled,
  });

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
            className="flex items-center gap-2 text-muted-foreground text-xs [&_svg]:size-4"
            aria-live="polite"
          >
            {isLoading ? (
              <>
                <Spinner />
                Taking screenshot...
              </>
            ) : blocked ? (
              <>
                <ShieldWarningIcon />
                Screenshot unavailable for this domain.
              </>
            ) : (
              <>
                <XCircleIcon />
                Unable to take a screenshot.
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
