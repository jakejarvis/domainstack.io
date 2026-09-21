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
/** Base delay for the first backoff retry after a transient start/poll failure. */
const POLL_RECOVERY_BASE_MS = 5000;
/** Ceiling on the exponential backoff delay, so a sustained outage still polls occasionally. */
const POLL_RECOVERY_MAX_MS = 60_000;
/** After giving up, how long before trying again on its own (self-heal, not hammering). */
const GIVE_UP_RECOVERY_MS = 5 * 60_000;
/**
 * Give up after this many consecutive transient failures (start or poll
 * requests that threw — network errors, 5xx, malformed responses) rather
 * than polling forever. A fixed-interval retry loop with no cap would
 * otherwise re-invoke `startScreenshot` (a non-idempotent, expensive,
 * headless-browser-starting POST) indefinitely against a persistently
 * failing endpoint.
 */
const MAX_CONSECUTIVE_FAILURES = 5;

type ScreenshotQueryState =
  | { status: "completed"; source: "cache" | "workflow"; data: ScreenshotData }
  | { status: "running"; runId: string }
  // `recoverable`: reached by giving up on repeated transient errors, not a
  // definitive server signal — retried again after a long cooldown instead
  // of staying failed until the query is garbage-collected or reloaded.
  | { status: "failed"; error: string; recoverable?: boolean }
  | { status: "rate_limited"; retryAfter: number; runId?: string }
  | { status: "retrying"; attempt: number; runId?: string };

type TerminalScreenshotQueryState = Extract<
  ScreenshotQueryState,
  { status: "completed" | "failed" }
>;

/** Exponential backoff (capped, with jitter) for the Nth consecutive transient failure. */
function backoffDelayMs(attempt: number): number {
  const exponential = Math.min(POLL_RECOVERY_BASE_MS * 2 ** (attempt - 1), POLL_RECOVERY_MAX_MS);
  const jitterMs = Math.floor(Math.random() * 500);
  return exponential + jitterMs;
}

/** The run id to keep polling, carried over from any non-terminal state that has one. */
function runIdFromState(state: ScreenshotQueryState | undefined): string | undefined {
  if (state?.status === "running") return state.runId;
  if (state?.status === "rate_limited") return state.runId;
  if (state?.status === "retrying") return state.runId;
  return undefined;
}

interface ScreenshotDataPayload {
  blocked?: unknown;
  url?: unknown;
}

interface ScreenshotResponsePayload {
  data?: ScreenshotDataPayload;
  error?: unknown;
  runId?: unknown;
  status?: unknown;
  success?: unknown;
}

function getScreenshotQueryKey(domain: string, domainId?: string) {
  return ["screenshot", domainId ?? domain] as const;
}

function parseScreenshotData(payload: ScreenshotDataPayload | null): ScreenshotData {
  if (!payload) {
    throw new Error("Screenshot response is missing data");
  }

  return {
    url: typeof payload.url === "string" ? payload.url : null,
    blocked: payload.blocked === true,
  };
}

function parseStartResponse(payload: ScreenshotResponsePayload | null): ScreenshotQueryState {
  if (!payload) {
    throw new Error("Invalid screenshot response");
  }

  if ("error" in payload && !("status" in payload)) {
    throw new Error(
      typeof payload.error === "string" ? payload.error : "Screenshot request failed",
    );
  }

  if (payload.status === "running" && typeof payload.runId === "string") {
    return { status: "running", runId: payload.runId };
  }

  if (payload.status === "completed" && payload.success === false) {
    return {
      status: "failed",
      error: typeof payload.error === "string" ? payload.error : "Screenshot capture failed",
    };
  }

  if (payload.status === "completed" && payload.data) {
    return {
      status: "completed",
      source: "cache",
      data: parseScreenshotData(payload.data),
    };
  }

  throw new Error("Unknown screenshot response format");
}

function parseStatusResponse(
  payload: ScreenshotResponsePayload | null,
  runId: string,
): ScreenshotQueryState {
  if (!payload) {
    throw new Error("Invalid screenshot status response");
  }

  if ("error" in payload && !("status" in payload)) {
    throw new Error(
      typeof payload.error === "string" ? payload.error : "Screenshot status unavailable",
    );
  }

  if (payload.status === "running") {
    return { status: "running", runId };
  }

  if (payload.status === "failed") {
    return {
      status: "failed",
      error: typeof payload.error === "string" ? payload.error : "Workflow failed",
    };
  }

  if (payload.status === "completed" && payload.data) {
    return {
      status: "completed",
      source: "workflow",
      data: parseScreenshotData(payload.data),
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

  return parseStartResponse((await response.json()) as ScreenshotResponsePayload);
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
    const error = await readErrorMessage(
      response,
      `Screenshot status poll failed: ${response.status}`,
    );
    if (response.status >= 400 && response.status < 500) {
      // A run id that's gone or invalid will never resolve — fail now
      // instead of burning retries on a poll that can't succeed.
      return { status: "failed", error };
    }
    throw new Error(error);
  }

  return parseStatusResponse((await response.json()) as ScreenshotResponsePayload, runId);
}

/** True for a state that won't resolve on its own without a scheduled retry — no immediate remount refetch. */
function isAwaitingScheduledRetry(state: ScreenshotQueryState | undefined): boolean {
  return state?.status === "retrying" || (state?.status === "failed" && !!state.recoverable);
}

function isTerminalState(
  state: ScreenshotQueryState | undefined,
): state is TerminalScreenshotQueryState {
  return state?.status === "completed" || (state?.status === "failed" && !state.recoverable);
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

      if (isTerminalState(current)) {
        return current;
      }

      const runId = runIdFromState(current);
      const attempt = current?.status === "retrying" ? current.attempt : 0;

      if (!runId && !domainId) {
        // Deterministic (the `enabled` guard already requires a domainId) —
        // never retryable, so this throws instead of feeding the backoff loop.
        throw new Error("Screenshot domain ID is missing");
      }

      try {
        return runId ? await pollScreenshot(runId) : await startScreenshot(domainId as string);
      } catch (err) {
        if (attempt + 1 >= MAX_CONSECUTIVE_FAILURES) {
          analytics.trackException(err, { domain });
          return {
            status: "failed" as const,
            error: err instanceof Error ? err.message : "Screenshot request failed",
            recoverable: true,
          };
        }
        return { status: "retrying" as const, attempt: attempt + 1, runId };
      }
    },
    enabled: enabled && !!domainId,
    retry: false,
    staleTime: (query) => (isTerminalState(query.state.data) ? Number.POSITIVE_INFINITY : 0),
    refetchOnMount: (query) =>
      !isTerminalState(query.state.data) && !isAwaitingScheduledRetry(query.state.data),
    refetchInterval: (query) => {
      const state = query.state.data;
      // Checked before isTerminalState: its type predicate narrows "failed"
      // out of the union entirely, which would make this branch unreachable.
      if (state?.status === "failed" && state.recoverable) {
        return GIVE_UP_RECOVERY_MS;
      }
      if (isTerminalState(state)) {
        return false;
      }
      if (state?.status === "rate_limited") {
        return state.retryAfter * 1000;
      }
      if (state?.status === "running") {
        return POLL_INTERVAL_MS;
      }
      if (state?.status === "retrying") {
        return backoffDelayMs(state.attempt);
      }
      // No state yet: the very first attempt, poll soon.
      return POLL_RECOVERY_BASE_MS;
    },
    refetchIntervalInBackground: true,
  });

  const reportedStateRef = useRef<string | null>(null);
  useEffect(() => {
    const state = screenshotQuery.data;
    if (!state) return;

    const marker = ((): string => {
      switch (state.status) {
        case "running":
          return `running:${state.runId}`;
        case "completed":
          return `completed:${state.source}:${state.data.url ?? "none"}`;
        case "rate_limited":
          return `rate-limited:${state.runId ?? "start"}:${state.retryAfter}`;
        case "retrying":
          return `retrying:${state.runId ?? "start"}:${state.attempt}`;
        case "failed":
          return `failed:${state.error}`;
      }
    })();
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
