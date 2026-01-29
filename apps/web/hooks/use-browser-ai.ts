"use client";

import { browserAI, doesBrowserSupportBrowserAI } from "@browser-ai/core";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Browser AI availability status.
 * - unavailable: Browser doesn't support built-in AI
 * - checking: Checking model availability
 * - downloadable: Model needs to be downloaded first
 * - downloading: Model is currently downloading
 * - ready: Model is ready to use
 * - error: An error occurred during initialization
 */
export type BrowserAIStatus =
  | "unavailable"
  | "checking"
  | "downloadable"
  | "downloading"
  | "ready"
  | "error";

export interface UseBrowserAIResult {
  /** Current status of the browser AI model */
  status: BrowserAIStatus;
  /** Download progress (0-1) when status is "downloading" */
  downloadProgress: number;
  /** Error message if status is "error" */
  error: string | null;
  /** The browser AI model instance (only available when status is "ready") */
  model: ReturnType<typeof browserAI> | null;
  /** Manually trigger model download/initialization */
  initialize: () => Promise<void>;
}

/**
 * Hook to detect and manage browser AI availability.
 *
 * Automatically checks browser support and model availability on mount.
 * When the model is downloadable, call `initialize()` to start the download.
 *
 * @example
 * ```tsx
 * const { status, model, initialize, downloadProgress } = useBrowserAI();
 *
 * if (status === "unavailable") {
 *   return <p>Your browser doesn't support local AI</p>;
 * }
 *
 * if (status === "downloadable") {
 *   return <button onClick={initialize}>Download AI Model</button>;
 * }
 *
 * if (status === "downloading") {
 *   return <p>Downloading: {Math.round(downloadProgress * 100)}%</p>;
 * }
 *
 * if (status === "ready" && model) {
 *   // Use model with AI SDK
 * }
 * ```
 */
export function useBrowserAI(): UseBrowserAIResult {
  const [status, setStatus] = useState<BrowserAIStatus>("checking");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<ReturnType<typeof browserAI> | null>(null);

  // Track if we've already initialized to prevent double-init
  const initializingRef = useRef(false);
  const modelInstanceRef = useRef<ReturnType<typeof browserAI> | null>(null);
  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Check browser support and model availability on mount
  useEffect(() => {
    isMountedRef.current = true;

    async function checkAvailability() {
      // First check if browser supports the API at all
      if (!doesBrowserSupportBrowserAI()) {
        if (isMountedRef.current) setStatus("unavailable");
        return;
      }

      try {
        // Create the model instance to check availability
        const instance = browserAI();
        modelInstanceRef.current = instance;

        const availability = await instance.availability();

        if (!isMountedRef.current) return;

        switch (availability) {
          case "unavailable":
            setStatus("unavailable");
            break;
          case "downloadable":
            setStatus("downloadable");
            break;
          case "downloading":
            setStatus("downloading");
            break;
          case "available":
            setModel(instance);
            setStatus("ready");
            break;
          default:
            // Handle any future states gracefully
            setStatus("unavailable");
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to check AI availability",
        );
        setStatus("error");
      }
    }

    void checkAvailability();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize (download) the model
  const initialize = useCallback(async () => {
    if (initializingRef.current) return;
    if (status !== "downloadable" && status !== "error") return;

    initializingRef.current = true;
    setStatus("downloading");
    setDownloadProgress(0);
    setError(null);

    try {
      const instance = modelInstanceRef.current ?? browserAI();
      modelInstanceRef.current = instance;

      // Create session with progress tracking
      await instance.createSessionWithProgress((progress) => {
        if (isMountedRef.current) setDownloadProgress(progress);
      });

      if (isMountedRef.current) {
        setModel(instance);
        setStatus("ready");
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to initialize AI model",
        );
        setStatus("error");
      }
    } finally {
      initializingRef.current = false;
    }
  }, [status]);

  return {
    status,
    downloadProgress,
    error,
    model,
    initialize,
  };
}
