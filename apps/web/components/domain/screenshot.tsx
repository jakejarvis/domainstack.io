"use client";

import { IconCircleX, IconShieldExclamation } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { analytics } from "@/lib/analytics/client";
import { parseRetryAfterHeader } from "@/lib/ratelimit/client";
import type { ScreenshotData } from "@domainstack/types";
import { Spinner } from "@domainstack/ui/spinner";
import { cn } from "@domainstack/ui/utils";

const POLL_INTERVAL_MS = 2000;
const POLL_RECOVERY_INTERVAL_MS = 5000;

type ScreenshotQueryState =
  | { status: "completed"; source: "cache" | "workflow"; data: ScreenshotData }
  | { status: "running"; runId: string }
  | { status: "failed"; error: string }
  | { status: "rate_limited"; retryAfter: number; runId?: string };

type TerminalScreenshotQueryState = Extract<
  ScreenshotQueryState,
  { status: "completed" | "failed" }
>;

function getScreenshotQueryKey(domain: string, domainId?: string) {
  return ["screenshot", domainId ?? domain] as const;
}

function parseScreenshotData(raw: unknown): ScreenshotData {
  if (!raw || typeof raw !== "object") {
    throw new Error("Screenshot response is missing data");
  }

  const data = raw as Record<string, unknown>;
  return {
    url: typeof data.url === "string" ? data.url : null,
    blocked: data.blocked === true,
  };
}

function parseStartResponse(raw: unknown): ScreenshotQueryState {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid screenshot response");
  }

  const obj = raw as Record<string, unknown>;

  if ("error" in obj && !("status" in obj)) {
    throw new Error(typeof obj.error === "string" ? obj.error : "Screenshot request failed");
  }

  if (obj.status === "running" && typeof obj.runId === "string") {
    return { status: "running", runId: obj.runId };
  }

  if (obj.status === "completed" && obj.success === false) {
    return {
      status: "failed",
      error: typeof obj.error === "string" ? obj.error : "Screenshot capture failed",
    };
  }

  if (obj.status === "completed" && obj.data) {
    return {
      status: "completed",
      source: "cache",
      data: parseScreenshotData(obj.data),
    };
  }

  throw new Error("Unknown screenshot response format");
}

function parseStatusResponse(raw: unknown, runId: string): ScreenshotQueryState {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid screenshot status response");
  }

  const obj = raw as Record<string, unknown>;

  if ("error" in obj && !("status" in obj)) {
    throw new Error(typeof obj.error === "string" ? obj.error : "Screenshot status unavailable");
  }

  if (obj.status === "running") {
    return { status: "running", runId };
  }

  if (obj.status === "failed") {
    return {
      status: "failed",
      error: typeof obj.error === "string" ? obj.error : "Workflow failed",
    };
  }

  if (obj.status === "completed" && obj.data) {
    return {
      status: "completed",
      source: "workflow",
      data: parseScreenshotData(obj.data),
    };
  }

  throw new Error("Unknown screenshot status response format");
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const raw = (await response.json()) as { error?: unknown };
    return typeof raw.error === "string" ? raw.error : fallback;
  } catch {
    return fallback;
  }
}

async function startScreenshot(domainId: string): Promise<ScreenshotQueryState> {
  const response = await fetch("/api/screenshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domainId }),
  });

  if (response.status === 429) {
    return { status: "rate_limited", retryAfter: parseRetryAfterHeader(response) };
  }

  if (!response.ok) {
    const error = await readErrorMessage(response, `Screenshot request failed: ${response.status}`);
    if (response.status >= 400 && response.status < 500) {
      return { status: "failed", error };
    }
    throw new Error(error);
  }

  return parseStartResponse(await response.json());
}

async function pollScreenshot(runId: string): Promise<ScreenshotQueryState> {
  const response = await fetch(`/api/screenshot?runId=${encodeURIComponent(runId)}`, {
    cache: "no-store",
  });

  if (response.status === 429) {
    return {
      status: "rate_limited",
      retryAfter: parseRetryAfterHeader(response),
      runId,
    };
  }

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Screenshot status poll failed: ${response.status}`),
    );
  }

  return parseStatusResponse(await response.json(), runId);
}

function isTerminalState(
  state: ScreenshotQueryState | undefined,
): state is TerminalScreenshotQueryState {
  return state?.status === "completed" || state?.status === "failed";
}

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
              <button
                type="button"
                className="min-h-6 rounded-sm px-1.5 font-medium text-foreground underline underline-offset-2 hover:text-foreground/80 focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={onReload}
              >
                Reload preview
              </button>
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

      if (current?.status === "running") {
        return pollScreenshot(current.runId);
      }
      if (current?.status === "rate_limited" && current.runId) {
        return pollScreenshot(current.runId);
      }
      if (isTerminalState(current)) {
        return current;
      }

      if (!domainId) {
        throw new Error("Screenshot domain ID is missing");
      }
      return startScreenshot(domainId);
    },
    enabled: enabled && !!domainId,
    retry: false,
    staleTime: (query) => (isTerminalState(query.state.data) ? Number.POSITIVE_INFINITY : 0),
    refetchOnMount: (query) => !isTerminalState(query.state.data),
    refetchInterval: (query) => {
      const state = query.state.data;
      if (isTerminalState(state)) {
        return false;
      }
      if (state?.status === "rate_limited") {
        return state.retryAfter * 1000;
      }
      return state?.status === "running" ? POLL_INTERVAL_MS : POLL_RECOVERY_INTERVAL_MS;
    },
    refetchIntervalInBackground: true,
  });

  const reportedStateRef = useRef<string | null>(null);
  useEffect(() => {
    const state = screenshotQuery.data;
    if (!state) return;

    const marker =
      state.status === "running"
        ? `running:${state.runId}`
        : state.status === "completed"
          ? `completed:${state.source}:${state.data.url ?? "none"}`
          : state.status === "rate_limited"
            ? `rate-limited:${state.runId ?? "start"}:${state.retryAfter}`
            : `failed:${state.error}`;
    if (reportedStateRef.current === marker) return;
    reportedStateRef.current = marker;

    if (state.status === "running") {
      analytics.track("screenshot_requested", { domain });
    } else if (state.status === "completed") {
      analytics.track(
        state.source === "cache" ? "screenshot_loaded_from_cache" : "screenshot_loaded_from_api",
        { domain },
      );
    } else if (state.status === "rate_limited") {
      toast.error("Too many requests", {
        id: `screenshot-rate-limited-${domainId ?? domain}`,
        description: `Retrying in ${state.retryAfter} second${state.retryAfter !== 1 ? "s" : ""}.`,
      });
      analytics.track("screenshot_rate_limited", {
        domain,
        retryAfter: state.retryAfter,
      });
    }
  }, [screenshotQuery.data, domain, domainId]);

  useEffect(() => {
    if (screenshotQuery.error) {
      analytics.trackException(screenshotQuery.error, { domain });
    }
  }, [screenshotQuery.error, domain]);

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
