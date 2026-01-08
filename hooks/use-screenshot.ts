"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analytics } from "@/lib/analytics/client";

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
 */
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

/**
 * Parse the raw status poll response into our clean typed format.
 */
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

/**
 * Hook for fetching domain screenshots using the polling-based API.
 */
export function useScreenshot({
  domainId,
  domain,
  enabled = true,
}: UseScreenshotOptions): UseScreenshotResult {
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);
  // Store the completed screenshot data in state to ensure re-renders
  const [screenshotData, setScreenshotData] = useState<ScreenshotData | null>(
    null,
  );
  const hasStartedRef = useRef(false);
  const startedForDomainRef = useRef<string | null>(null);

  const screenshotQueryKey = useMemo(() => ["screenshot", domain], [domain]);

  // Check for cached data from previous sessions
  const cachedData =
    queryClient.getQueryData<ScreenshotData>(screenshotQueryKey);

  // Stable callback for the mutation
  const startScreenshot = useCallback(async (id: string) => {
    const response = await fetch("/api/screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainId: id }),
    });

    if (!response.ok) {
      throw new Error(`Screenshot request failed: ${response.status}`);
    }

    return parseStartResponse(await response.json());
  }, []);

  // Mutation to start the screenshot workflow
  const startMutation = useMutation({
    mutationFn: startScreenshot,
    onSuccess: (data) => {
      if (data.status === "completed") {
        // Store in state to trigger re-render
        setScreenshotData(data.data);
        // Also cache for future visits
        queryClient.setQueryData(screenshotQueryKey, data.data);
        // Track cache hit
        analytics.track("screenshot_loaded_from_cache", { domain });
      } else if (data.status === "running") {
        setRunId(data.runId);
        analytics.track("screenshot_requested", { domain });
      }
    },
    onError: (error) => {
      analytics.trackException(error, { domain });
    },
  });

  // Query to poll for workflow status (only when we have a runId)
  const statusQuery = useQuery({
    queryKey: ["screenshot-status", runId],
    queryFn: async (): Promise<ScreenshotStatusResponse> => {
      const response = await fetch(`/api/screenshot?runId=${runId}`);
      if (!response.ok) {
        throw new Error(`Screenshot status poll failed: ${response.status}`);
      }
      return parseStatusResponse(await response.json());
    },
    enabled: !!runId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.status !== "running") {
        return false; // Stop polling
      }
      return POLL_INTERVAL_MS;
    },
  });

  // Handle polling completion
  useEffect(() => {
    const data = statusQuery.data;
    if (!data || data.status === "running") return;

    if (data.status === "completed") {
      setScreenshotData(data.data);
      queryClient.setQueryData(screenshotQueryKey, data.data);
      analytics.track("screenshot_loaded_from_api", { domain });
    }
    setRunId(null);
  }, [statusQuery.data, queryClient, screenshotQueryKey, domain]);

  // Reset and auto-start when domain/enabled/domainId changes
  useEffect(() => {
    // Reset if domain changed
    if (startedForDomainRef.current !== domain) {
      hasStartedRef.current = false;
      startedForDomainRef.current = domain;
      setScreenshotData(null);
      setRunId(null);
    }

    // Skip if already started, disabled, no domainId, or have cached/current data
    if (
      hasStartedRef.current ||
      !enabled ||
      !domainId ||
      cachedData ||
      screenshotData
    ) {
      return;
    }

    hasStartedRef.current = true;
    startMutation.mutate(domainId);
  }, [domain, enabled, domainId, cachedData, screenshotData, startMutation]);

  // --- Derive the result ---

  // 1. Check screenshot data from state (from current session)
  if (screenshotData) {
    return {
      url: screenshotData.url,
      blocked: screenshotData.blocked,
      isLoading: false,
      error: null,
    };
  }

  // 2. Check cached data from query client (from previous page loads)
  if (cachedData) {
    return {
      url: cachedData.url,
      blocked: cachedData.blocked,
      isLoading: false,
      error: null,
    };
  }

  // 3. Check for errors
  if (startMutation.error) {
    return {
      url: null,
      blocked: false,
      isLoading: false,
      error: startMutation.error,
    };
  }

  if (statusQuery.error) {
    return {
      url: null,
      blocked: false,
      isLoading: false,
      error: statusQuery.error,
    };
  }

  if (statusQuery.data?.status === "failed") {
    return {
      url: null,
      blocked: false,
      isLoading: false,
      error: new Error(statusQuery.data.error),
    };
  }

  // 4. Still loading
  const isLoading =
    enabled && (domainId === undefined || startMutation.isPending || !!runId);

  return {
    url: null,
    blocked: false,
    isLoading,
    error: null,
  };
}
