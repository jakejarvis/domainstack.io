"use client";

import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";
import { IconCircleX, IconShieldExclamation } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { analytics } from "@/lib/analytics/client";
import { parseRetryAfterHeader } from "@/lib/ratelimit/client";

type ScreenshotStartResponse =
  | { status: "completed"; data: ScreenshotData }
  | { status: "running"; runId: string }
  | { status: "error"; error: string }
  | { status: "rate_limited"; retryAfter: number };

type ScreenshotStatusResponse =
  | { status: "running" }
  | { status: "completed"; data: ScreenshotData }
  | { status: "failed"; error: string }
  | { status: "error"; error: string }
  | { status: "rate_limited"; retryAfter: number };

export interface ScreenshotData {
  url: string | null;
  blocked: boolean;
}

const POLL_INTERVAL_MS = 2000;

function parseStartResponse(raw: unknown): ScreenshotStartResponse {
  if (!raw || typeof raw !== "object") {
    return { status: "error", error: "Invalid response" };
  }

  const obj = raw as Record<string, unknown>;

  if ("error" in obj && !("status" in obj)) {
    return { status: "error", error: String(obj.error) };
  }

  if (obj.status === "running" && typeof obj.runId === "string") {
    return { status: "running", runId: obj.runId };
  }

  if (obj.status === "completed" && obj.data) {
    const data = obj.data as Record<string, unknown>;
    return {
      status: "completed",
      data: {
        url: typeof data.url === "string" ? data.url : null,
        blocked: data.blocked === true,
      },
    };
  }

  return { status: "error", error: "Unknown response format" };
}

function parseStatusResponse(raw: unknown): ScreenshotStatusResponse {
  if (!raw || typeof raw !== "object") {
    return { status: "error", error: "Invalid response" };
  }

  const obj = raw as Record<string, unknown>;

  if ("error" in obj && !("status" in obj)) {
    return { status: "error", error: String(obj.error) };
  }

  if (obj.status === "running") {
    return { status: "running" };
  }

  if (obj.status === "failed") {
    return { status: "failed", error: String(obj.error ?? "Workflow failed") };
  }

  if (obj.status === "completed" && obj.data) {
    const data = obj.data as Record<string, unknown>;
    return {
      status: "completed",
      data: {
        url: typeof data.url === "string" ? data.url : null,
        blocked: data.blocked === true,
      },
    };
  }

  return { status: "error", error: "Unknown response format" };
}

export interface UseScreenshotResult {
  data: ScreenshotData | null;
  isLoading: boolean;
  error: Error | null;
  hasFailed: boolean;
}

/**
 * Hook to fetch a screenshot for a domain.
 * Call this in a component that stays mounted to keep polling active.
 */
export function useScreenshot({
  domain,
  domainId,
  enabled = true,
}: {
  domain: string;
  domainId?: string;
  enabled?: boolean;
}): UseScreenshotResult {
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);
  const [screenshotData, setScreenshotData] = useState<ScreenshotData | null>(
    null,
  );
  const hasStartedRef = useRef(false);
  const startedForDomainRef = useRef<string | null>(null);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const screenshotQueryKey = useMemo(() => ["screenshot", domain], [domain]);
  const cachedData =
    queryClient.getQueryData<ScreenshotData>(screenshotQueryKey);

  const startScreenshot = useCallback(async (id: string) => {
    const response = await fetch("/api/screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainId: id }),
    });

    if (response.status === 429) {
      const retryAfter = parseRetryAfterHeader(response);
      return { status: "rate_limited", retryAfter } as const;
    }

    if (!response.ok) {
      throw new Error(`Screenshot request failed: ${response.status}`);
    }

    return parseStartResponse(await response.json());
  }, []);

  const startMutation = useMutation({
    mutationFn: startScreenshot,
    onSuccess: (data) => {
      if (data.status === "completed") {
        setScreenshotData(data.data);
        queryClient.setQueryData(screenshotQueryKey, data.data);
        analytics.track("screenshot_loaded_from_cache", { domain });
      } else if (data.status === "running") {
        setRunId(data.runId);
        analytics.track("screenshot_requested", { domain });
      } else if (data.status === "rate_limited") {
        const retryAt = Date.now() + data.retryAfter * 1000;
        setRateLimitedUntil(retryAt);
        toast.error("Too many requests", {
          description: `Please wait ${data.retryAfter} second${data.retryAfter !== 1 ? "s" : ""} before trying again.`,
        });
        analytics.track("screenshot_rate_limited", {
          domain,
          retryAfter: data.retryAfter,
        });

        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        retryTimeoutRef.current = setTimeout(() => {
          hasStartedRef.current = false;
          setRateLimitedUntil(null);
        }, data.retryAfter * 1000);
      }
    },
    onError: (error) => {
      analytics.trackException(error, { domain });
    },
  });

  const statusQuery = useQuery({
    queryKey: ["screenshot-status", runId],
    queryFn: async (): Promise<ScreenshotStatusResponse> => {
      const response = await fetch(`/api/screenshot?runId=${runId}`);

      if (response.status === 429) {
        const retryAfter = parseRetryAfterHeader(response);
        return { status: "rate_limited", retryAfter };
      }

      if (!response.ok) {
        throw new Error(`Screenshot status poll failed: ${response.status}`);
      }
      return parseStatusResponse(await response.json());
    },
    enabled: !!runId,
    refetchInterval: (query) => {
      const { data } = query.state;
      if (data?.status !== "running") {
        if (data?.status === "rate_limited") {
          return data.retryAfter * 1000;
        }
        return false;
      }
      return POLL_INTERVAL_MS;
    },
  });

  // Handle polling completion
  useEffect(() => {
    if (!statusQuery.data || statusQuery.data.status === "running") return;

    if (statusQuery.data.status === "completed") {
      setScreenshotData(statusQuery.data.data);
      queryClient.setQueryData(screenshotQueryKey, statusQuery.data.data);
      analytics.track("screenshot_loaded_from_api", { domain });
      setRunId(null);
    } else if (statusQuery.data.status === "rate_limited") {
      toast.error("Too many requests", {
        description: `Polling paused. Retrying in ${statusQuery.data.retryAfter} seconds.`,
      });
    } else {
      setRunId(null);
    }
  }, [statusQuery.data, queryClient, screenshotQueryKey, domain]);

  // Cleanup retry timeout on unmount
  useEffect(
    () => () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    },
    [],
  );

  // Reset and auto-start when domain/enabled/domainId changes
  useEffect(() => {
    if (startedForDomainRef.current !== domain) {
      hasStartedRef.current = false;
      startedForDomainRef.current = domain;
      setScreenshotData(null);
      setRunId(null);
      setRateLimitedUntil(null);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    }

    if (
      hasStartedRef.current ||
      !enabled ||
      !domainId ||
      cachedData ||
      screenshotData
    ) {
      return;
    }

    if (rateLimitedUntil && Date.now() < rateLimitedUntil) {
      return;
    }

    hasStartedRef.current = true;
    startMutation.mutate(domainId);
  }, [
    domain,
    enabled,
    domainId,
    cachedData,
    screenshotData,
    startMutation,
    rateLimitedUntil,
  ]);

  // Derive return values
  const finalData = screenshotData ?? cachedData ?? null;
  const error = startMutation.error ?? statusQuery.error ?? null;
  const hasFailed = statusQuery.data?.status === "failed";
  const isLoading =
    !finalData &&
    !error &&
    !hasFailed &&
    enabled &&
    (domainId === undefined || startMutation.isPending || !!runId);

  return { data: finalData, isLoading, error, hasFailed };
}

/**
 * Display component for screenshot results.
 * Use with useScreenshot hook for data fetching.
 */
export function Screenshot({
  domain,
  data,
  isLoading,
  className,
  width = 1200,
  height = 630,
  imageClassName,
  aspectClassName = "aspect-[1200/630]",
}: {
  domain: string;
  data: ScreenshotData | null;
  isLoading: boolean;
  className?: string;
  width?: number;
  height?: number;
  imageClassName?: string;
  aspectClassName?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const url = data?.url ?? null;
  const blocked = data?.blocked ?? false;

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
                <IconShieldExclamation />
                Screenshot unavailable for this domain.
              </>
            ) : (
              <>
                <IconCircleX />
                Unable to take a screenshot.
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
