"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Response type from POST /api/screenshot
 */
type ScreenshotStartResponse =
  | { status: "completed"; data: ScreenshotData }
  | { status: "running"; runId: string }
  | { status: "error"; error: string };

/**
 * Response type from GET /api/screenshot?runId=xxx
 */
type ScreenshotStatusResponse =
  | { status: "running" }
  | { status: "completed"; data: ScreenshotData }
  | { status: "failed"; error: string }
  | { status: "error"; error: string };

/**
 * Normalized screenshot data
 */
interface ScreenshotData {
  url: string | null;
  blocked: boolean;
}

/**
 * Options for the useScreenshot hook
 */
interface UseScreenshotOptions {
  /** The domain ID to request screenshot for */
  domainId: string | undefined;
  /** The domain name (for display/cache key purposes) */
  domain: string;
  /** Whether to enable the screenshot request (default: true) */
  enabled?: boolean;
}

/**
 * Result from the useScreenshot hook
 */
interface UseScreenshotResult {
  /** The screenshot URL, or null if not available */
  url: string | null;
  /** Whether the domain is blocked from screenshots */
  blocked: boolean;
  /** Whether the screenshot is currently loading */
  isLoading: boolean;
  /** Error if the request failed */
  error: Error | null;
}

const POLL_INTERVAL_MS = 2000;

/**
 * Parse the raw API response into our clean typed format.
 * This handles the messy server response normalization in one place.
 */
function parseStartResponse(raw: unknown): ScreenshotStartResponse {
  if (!raw || typeof raw !== "object") {
    return { status: "error", error: "Invalid response" };
  }

  const obj = raw as Record<string, unknown>;

  // Error response (no status)
  if ("error" in obj && !("status" in obj)) {
    return { status: "error", error: String(obj.error) };
  }

  // Running
  if (obj.status === "running" && typeof obj.runId === "string") {
    return { status: "running", runId: obj.runId };
  }

  // Completed with cached data
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

/**
 * Parse the raw status poll response into our clean typed format.
 */
function parseStatusResponse(raw: unknown): ScreenshotStatusResponse {
  if (!raw || typeof raw !== "object") {
    return { status: "error", error: "Invalid response" };
  }

  const obj = raw as Record<string, unknown>;

  // Error response (no status)
  if ("error" in obj && !("status" in obj)) {
    return { status: "error", error: String(obj.error) };
  }

  // Running
  if (obj.status === "running") {
    return { status: "running" };
  }

  // Failed
  if (obj.status === "failed") {
    return { status: "failed", error: String(obj.error ?? "Workflow failed") };
  }

  // Completed
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

/**
 * Hook for fetching domain screenshots using the polling-based API.
 *
 * This hook:
 * 1. POSTs to /api/screenshot with the domainId to start the workflow
 * 2. If the response is cached, returns immediately
 * 3. If the workflow is running, polls GET /api/screenshot?runId=xxx until complete
 * 4. Caches the final result in TanStack Query for subsequent renders
 */
export function useScreenshot({
  domainId,
  domain,
  enabled = true,
}: UseScreenshotOptions): UseScreenshotResult {
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  // Cache key for the final screenshot result (memoized to avoid recreating on every render)
  const screenshotQueryKey = useMemo(() => ["screenshot", domain], [domain]);

  // Check if we already have cached data
  const cachedData =
    queryClient.getQueryData<ScreenshotData>(screenshotQueryKey);

  // Mutation to start the screenshot workflow
  const startMutation = useMutation({
    mutationFn: async (id: string): Promise<ScreenshotStartResponse> => {
      const response = await fetch("/api/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId: id }),
      });

      // Check for HTTP errors
      if (!response.ok) {
        throw new Error(`Screenshot request failed: ${response.status}`);
      }

      return parseStartResponse(await response.json());
    },
    onSuccess: (data) => {
      if (data.status === "completed") {
        queryClient.setQueryData(screenshotQueryKey, data.data);
      } else if (data.status === "running") {
        setRunId(data.runId);
      } else if (data.status === "error") {
        // Cache failure state to stop loading
        queryClient.setQueryData(screenshotQueryKey, {
          url: null,
          blocked: false,
        });
      }
    },
  });

  // Query to poll for workflow status
  const statusQuery = useQuery({
    queryKey: ["screenshot-status", runId],
    queryFn: async (): Promise<ScreenshotStatusResponse> => {
      const response = await fetch(`/api/screenshot?runId=${runId}`);

      // Check for HTTP errors
      if (!response.ok) {
        throw new Error(`Screenshot status poll failed: ${response.status}`);
      }

      return parseStatusResponse(await response.json());
    },
    enabled: !!runId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return POLL_INTERVAL_MS;

      // Stop polling when not running
      if (data.status !== "running") {
        return false;
      }

      return POLL_INTERVAL_MS;
    },
  });

  // Handle poll completion - update cache and clear runId
  useEffect(() => {
    const data = statusQuery.data;
    if (!data) return;

    if (data.status === "completed") {
      queryClient.setQueryData(screenshotQueryKey, data.data);
      setRunId(null);
    } else if (data.status === "failed" || data.status === "error") {
      queryClient.setQueryData(screenshotQueryKey, {
        url: null,
        blocked: false,
      });
      setRunId(null);
    }
  }, [statusQuery.data, queryClient, screenshotQueryKey]);

  // Auto-start the workflow when enabled and domainId is available
  useEffect(() => {
    if (
      enabled &&
      domainId &&
      !cachedData &&
      !hasStarted &&
      !startMutation.isPending
    ) {
      setHasStarted(true);
      startMutation.mutate(domainId);
    }
  }, [enabled, domainId, cachedData, hasStarted, startMutation]);

  // Reset hasStarted when domain changes
  const prevDomainRef = useRef(domain);
  useEffect(() => {
    if (prevDomainRef.current !== domain) {
      prevDomainRef.current = domain;
      setHasStarted(false);
      setRunId(null);
    }
  }, [domain]);

  // Derive the result
  if (cachedData) {
    return {
      url: cachedData.url,
      blocked: cachedData.blocked,
      isLoading: false,
      error: null,
    };
  }

  const statusData = statusQuery.data;

  if (statusData?.status === "completed") {
    return {
      url: statusData.data.url,
      blocked: statusData.data.blocked,
      isLoading: false,
      error: null,
    };
  }

  if (statusData?.status === "failed") {
    return {
      url: null,
      blocked: false,
      isLoading: false,
      error: new Error(statusData.error),
    };
  }

  if (statusData?.status === "error") {
    return {
      url: null,
      blocked: false,
      isLoading: false,
      error: new Error(statusData.error),
    };
  }

  // Handle status query HTTP/network errors
  if (statusQuery.error) {
    return {
      url: null,
      blocked: false,
      isLoading: false,
      error: statusQuery.error,
    };
  }

  if (startMutation.error) {
    return {
      url: null,
      blocked: false,
      isLoading: false,
      error: startMutation.error,
    };
  }

  // Still loading
  const isLoading =
    enabled &&
    !!domainId &&
    (startMutation.isPending || !!runId || !hasStarted);

  return {
    url: null,
    blocked: false,
    isLoading,
    error: null,
  };
}
