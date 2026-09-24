"use client";

import { IconCircleX, IconShieldExclamation } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

import { analytics } from "@/lib/analytics/client";
import {
  getScreenshotQueryKey,
  isAwaitingScheduledRetry,
  isTerminalState,
  MAX_CONSECUTIVE_FAILURES,
  pollDelayMs,
  pollScreenshot,
  runIdFromState,
  type ScreenshotQueryState,
  startScreenshot,
} from "@/lib/screenshot";
import type { ScreenshotData } from "@domainstack/types";
import { Button } from "@domainstack/ui/button";
import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";

export interface UseScreenshotResult {
  data: ScreenshotData | null;
  isLoading: boolean;
  error: Error | null;
  hasFailed: boolean;
}

function ScreenshotPlaceholder({
  isLoading,
  blocked,
  aspectClassName,
  onReload,
}: {
  isLoading: boolean;
  blocked: boolean;
  aspectClassName: string;
  onReload?: () => void;
}) {
  return (
    <div
      className={`h-auto w-full ${aspectClassName} flex items-center justify-center bg-muted/50`}
    >
      <div
        className="flex items-center gap-2 text-xs text-muted-foreground [&_svg]:size-4"
        aria-live="polite"
      >
        {isLoading ? (
          <>
            <Spinner />
            Taking screenshot…
          </>
        ) : blocked ? (
          <>
            <IconShieldExclamation />
            Screenshot unavailable for this domain.
          </>
        ) : (
          <>
            <IconCircleX />
            <span>Unable to take a screenshot.</span>
            {onReload ? (
              <Button
                variant="link"
                size="xs"
                className="text-xs text-foreground"
                onClick={onReload}
              >
                Reload preview
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function withReloadToken(url: string, reloadCount: number): string {
  if (reloadCount === 0) return url;

  try {
    const reloadUrl = new URL(url);
    reloadUrl.searchParams.set("domainstack-reload", String(reloadCount));
    return reloadUrl.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}domainstack-reload=${reloadCount}`;
  }
}

function ScreenshotImage({
  domain,
  url,
  width,
  height,
  imageClassName,
  aspectClassName,
}: {
  domain: string;
  url: string;
  width: number;
  height: number;
  imageClassName?: string;
  aspectClassName: string;
}) {
  const [reloadCount, setReloadCount] = useState(0);
  const [hasFailed, setHasFailed] = useState(false);

  if (hasFailed) {
    return (
      <ScreenshotPlaceholder
        isLoading={false}
        blocked={false}
        aspectClassName={aspectClassName}
        onReload={() => {
          setReloadCount((current) => current + 1);
          setHasFailed(false);
        }}
      />
    );
  }

  return (
    <a href={`https://${domain}`} target="_blank" rel="noopener">
      <Image
        key={reloadCount}
        src={withReloadToken(url, reloadCount)}
        alt={`Homepage preview of ${domain}`}
        width={width}
        height={height}
        className={cn("h-auto w-full object-cover", aspectClassName, imageClassName)}
        unoptimized
        priority={false}
        draggable={false}
        onError={() => setHasFailed(true)}
      />
    </a>
  );
}

/** One step of the start/poll loop, folding transient failures into the backoff states. */
async function fetchNextState(
  current: ScreenshotQueryState | undefined,
  domainId: string | undefined,
  domain: string,
): Promise<ScreenshotQueryState> {
  const runId = runIdFromState(current);
  const attempt = current?.status === "retrying" ? current.attempt : 0;

  if (!runId && !domainId) {
    // Deterministic (the `enabled` guard already requires a domainId) —
    // never retryable, so this throws instead of feeding the backoff loop.
    const error = new Error("Screenshot domain ID is missing");
    analytics.trackException(error, { domain });
    throw error;
  }

  try {
    return runId ? await pollScreenshot(runId) : await startScreenshot(domainId as string);
  } catch (err) {
    if (attempt + 1 >= MAX_CONSECUTIVE_FAILURES) {
      analytics.trackException(err, { domain });
      return {
        status: "failed",
        error: err instanceof Error ? err.message : "Screenshot request failed",
        recoverable: true,
      };
    }
    return { status: "retrying", attempt: attempt + 1, runId };
  }
}

/**
 * Analytics and toasts for a state change. Called from the query function, which
 * runs once per fetch for all observers, so each transition is reported once.
 */
function reportTransition(
  prev: ScreenshotQueryState | undefined,
  next: ScreenshotQueryState,
  { domain, domainId }: { domain: string; domainId?: string },
) {
  const isSameRun = prev?.status === next.status && runIdFromState(prev) === runIdFromState(next);

  if (next.status === "running" && !isSameRun) {
    analytics.track("screenshot_requested", { domain });
  } else if (next.status === "completed") {
    analytics.track(
      next.source === "cache" ? "screenshot_loaded_from_cache" : "screenshot_loaded_from_api",
      { domain },
    );
  } else if (next.status === "rate_limited") {
    toast.error("Too many requests", {
      id: `screenshot-rate-limited-${domainId ?? domain}`,
      description: `Retrying in ${next.retryAfter} second${next.retryAfter !== 1 ? "s" : ""}.`,
    });
    analytics.track("screenshot_rate_limited", { domain, retryAfter: next.retryAfter });
  }
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
  const queryKey = getScreenshotQueryKey(domain, domainId);
  const screenshotQuery = useQuery<ScreenshotQueryState>({
    queryKey,
    queryFn: async () => {
      const current = queryClient.getQueryData<ScreenshotQueryState>(queryKey);
      if (isTerminalState(current)) return current;

      const next = await fetchNextState(current, domainId, domain);
      reportTransition(current, next, { domain, domainId });
      return next;
    },
    enabled: enabled && !!domainId,
    retry: false,
    staleTime: (query) => (isTerminalState(query.state.data) ? Number.POSITIVE_INFINITY : 0),
    refetchOnMount: (query) =>
      !isTerminalState(query.state.data) && !isAwaitingScheduledRetry(query.state.data),
    refetchInterval: (query) => pollDelayMs(query.state.data),
    refetchIntervalInBackground: true,
  });

  const state = screenshotQuery.data;
  const data = state?.status === "completed" ? state.data : null;
  const hasFailed = state?.status === "failed";
  const error = hasFailed ? new Error(state.error) : (screenshotQuery.error ?? null);
  const isLoading = enabled && (!domainId || (!data && !hasFailed));

  return { data, isLoading, error, hasFailed };
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
  const url = data?.url ?? null;
  const blocked = data?.blocked ?? false;

  return (
    <div className={className}>
      {url ? (
        <ScreenshotImage
          key={url}
          domain={domain}
          url={url}
          width={width}
          height={height}
          imageClassName={imageClassName}
          aspectClassName={aspectClassName}
        />
      ) : (
        <ScreenshotPlaceholder
          isLoading={isLoading}
          blocked={blocked}
          aspectClassName={aspectClassName}
        />
      )}
    </div>
  );
}
