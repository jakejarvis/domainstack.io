"use client";

import { browserAI, doesBrowserSupportBrowserAI } from "@browser-ai/core";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const NOOP_SUBSCRIBE = () => () => {};

type BrowserAIModel = ReturnType<typeof browserAI>;

/** One Prompt API instance + availability probe per tab, shared across open/close. */
let sharedModel: BrowserAIModel | null = null;
let sharedAvailability: Promise<string> | null = null;

function getSharedModel(): BrowserAIModel {
  sharedModel ??= browserAI();
  return sharedModel;
}

function browserSupportsBuiltInAI(): boolean {
  try {
    return doesBrowserSupportBrowserAI();
  } catch {
    return false;
  }
}

function getSharedAvailability(): Promise<string> {
  sharedAvailability ??= getSharedModel()
    .availability()
    .catch((err: unknown) => {
      // Allow a later open to retry after a failed probe
      sharedAvailability = null;
      throw err;
    });
  return sharedAvailability;
}

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
  model: BrowserAIModel | null;
  /** Manually trigger model download/initialization */
  initialize: () => Promise<void>;
}

export interface UseBrowserAIOptions {
  /** When false, skip the Prompt API availability probe. */
  enabled?: boolean;
}

/**
 * Hook to detect and manage browser AI availability.
 *
 * Browser support is detected synchronously. Model availability is probed once
 * the first time `enabled` is true (typically when the chat window opens) and
 * reused for later opens in the same tab. Closing the chat does not cancel or
 * restart the probe.
 * When the model is downloadable, call `initialize()` to start the download.
 *
 * @example
 * ```tsx
 * const { status, model, initialize, downloadProgress } = useBrowserAI({
 *   enabled: chatOpen,
 * });
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
export function useBrowserAI({ enabled = true }: UseBrowserAIOptions = {}): UseBrowserAIResult {
  // Synchronous client snapshot so unsupported browsers never sit on "checking"
  // waiting for an effect. Server snapshot is false to avoid hydration mismatch.
  const supported = useSyncExternalStore(NOOP_SUBSCRIBE, browserSupportsBuiltInAI, () => false);
  const [modelStatus, setModelStatus] = useState<BrowserAIStatus>("checking");
  const status: BrowserAIStatus = supported ? modelStatus : "unavailable";
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<BrowserAIModel | null>(null);

  // Track if we've already initialized to prevent double-init
  const initializingRef = useRef(false);
  const modelInstanceRef = useRef<BrowserAIModel | null>(null);
  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // Start at most one waiter per hook instance; the underlying probe is shared
  const probeStartedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // First open starts the probe. Later opens reuse it; closing does not abort.
  useEffect(() => {
    if (!enabled || !supported || probeStartedRef.current) return;
    probeStartedRef.current = true;

    const instance = getSharedModel();
    modelInstanceRef.current = instance;

    void (async () => {
      try {
        const availability = await getSharedAvailability();
        if (!isMountedRef.current) return;

        switch (availability) {
          case "unavailable":
            setModelStatus("unavailable");
            break;
          case "downloadable":
            setModelStatus("downloadable");
            break;
          case "downloading":
            setModelStatus("downloading");
            break;
          case "available":
            setModel(instance);
            setModelStatus("ready");
            break;
          default:
            setModelStatus("unavailable");
        }
      } catch (err) {
        probeStartedRef.current = false;
        if (!isMountedRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to check AI availability");
        setModelStatus("error");
      }
    })();
  }, [enabled, supported]);

  // Initialize (download) the model
  const initialize = useCallback(async () => {
    if (initializingRef.current) return;
    if (status !== "downloadable" && status !== "error") return;

    initializingRef.current = true;
    setModelStatus("downloading");
    setDownloadProgress(0);
    setError(null);

    try {
      const instance = modelInstanceRef.current ?? getSharedModel();
      modelInstanceRef.current = instance;

      // Create session with progress tracking
      await instance.createSessionWithProgress((progress) => {
        if (isMountedRef.current) setDownloadProgress(progress);
      });

      if (isMountedRef.current) {
        setModel(instance);
        setModelStatus("ready");
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to initialize AI model");
        setModelStatus("error");
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
