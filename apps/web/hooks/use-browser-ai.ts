"use client";

import { browserAI } from "@browser-ai/core";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const NOOP_SUBSCRIBE = () => () => {};
const AVAILABILITY_TIMEOUT_MS = 2_000;

type BrowserAIModel = ReturnType<typeof browserAI>;

/** One Prompt API instance + availability probe per tab, shared across open/close. */
let sharedModel: BrowserAIModel | null = null;
let sharedAvailability: Promise<string> | null = null;

function getLanguageModelGlobal(): { availability?: unknown } | undefined {
  try {
    return (globalThis as { LanguageModel?: { availability?: unknown } }).LanguageModel;
  } catch {
    return undefined;
  }
}

/** True only when the Prompt API is actually callable — not a bundler stub. */
function browserSupportsBuiltInAI(): boolean {
  return typeof getLanguageModelGlobal()?.availability === "function";
}

function getSharedModel(): BrowserAIModel {
  sharedModel ??= browserAI();
  return sharedModel;
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

/**
 * Hook to detect and manage browser AI availability.
 *
 * Browser support is detected synchronously. Model availability is probed once
 * on mount and reused for the rest of the tab. Closing the chat does not cancel
 * or restart the probe. When the model is downloadable, call `initialize()` to
 * start the download.
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

  // Probe on mount so local/auto is resolved before the panel opens. Gating on
  // the open state started a cloud session first, then swapped to local.
  useEffect(() => {
    if (!supported || probeStartedRef.current) return;
    probeStartedRef.current = true;

    let cancelled = false;

    const instance = getSharedModel();
    modelInstanceRef.current = instance;

    const applyAvailability = (availability: string) => {
      if (cancelled || !isMountedRef.current) return;

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
    };

    const applyProbeError = (err: unknown) => {
      probeStartedRef.current = false;
      if (cancelled || !isMountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to check AI availability");
      setModelStatus("error");
    };

    const probe = getSharedAvailability();

    void (async () => {
      try {
        const result = await Promise.race([
          probe.then((availability) => ({ timedOut: false as const, availability })),
          new Promise<{ timedOut: true }>((resolve) => {
            setTimeout(() => resolve({ timedOut: true }), AVAILABILITY_TIMEOUT_MS);
          }),
        ]);

        if (cancelled) return;

        if (result.timedOut) {
          // Don't sit on "Checking…" if the Prompt API never answers.
          if (isMountedRef.current) setModelStatus("unavailable");
          void probe.then(applyAvailability).catch(applyProbeError);
          return;
        }

        applyAvailability(result.availability);
      } catch (err) {
        applyProbeError(err);
      }
    })();

    return () => {
      cancelled = true;
      // Allow a later remount to wait on the shared probe
      probeStartedRef.current = false;
    };
  }, [supported]);

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
