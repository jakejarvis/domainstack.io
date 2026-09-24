/**
 * Screenshot capture protocol for `/api/screenshot`: start a capture (POST),
 * poll its workflow run (GET), and the retry/backoff policy around both.
 * `useScreenshot` drives these through a TanStack Query state machine.
 */
import { parseRetryAfterHeader } from "@/lib/ratelimit/client";
import type { ScreenshotData } from "@domainstack/types";

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
export const MAX_CONSECUTIVE_FAILURES = 5;

export type ScreenshotQueryState =
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
export function runIdFromState(state: ScreenshotQueryState | undefined): string | undefined {
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

export function getScreenshotQueryKey(domain: string, domainId?: string) {
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

/**
 * Parses a start (POST) or status poll (GET) response. A poll passes the
 * `runId` it asked about; a start carries its own and reports cache hits.
 */
function parseScreenshotResponse(
  payload: ScreenshotResponsePayload | null,
  polledRunId?: string,
): ScreenshotQueryState {
  if (!payload) {
    throw new Error("Invalid screenshot response");
  }

  const error = typeof payload.error === "string" ? payload.error : null;
  if ("error" in payload && !("status" in payload)) {
    throw new Error(error ?? "Screenshot request failed");
  }

  if (payload.status === "running") {
    const runId = typeof payload.runId === "string" ? payload.runId : polledRunId;
    if (runId) return { status: "running", runId };
  }

  if (
    payload.status === "failed" ||
    (payload.status === "completed" && payload.success === false)
  ) {
    return { status: "failed", error: error ?? "Screenshot capture failed" };
  }

  if (payload.status === "completed" && payload.data) {
    return {
      status: "completed",
      source: polledRunId ? "workflow" : "cache",
      data: parseScreenshotData(payload.data),
    };
  }

  throw new Error("Unknown screenshot response format");
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const raw = (await response.json()) as { error?: unknown };
    return typeof raw.error === "string" ? raw.error : fallback;
  } catch {
    return fallback;
  }
}

export async function startScreenshot(domainId: string): Promise<ScreenshotQueryState> {
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

  return parseScreenshotResponse((await response.json()) as ScreenshotResponsePayload);
}

export async function pollScreenshot(runId: string): Promise<ScreenshotQueryState> {
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

  return parseScreenshotResponse((await response.json()) as ScreenshotResponsePayload, runId);
}

/** True for a state that won't resolve on its own without a scheduled retry — no immediate remount refetch. */
export function isAwaitingScheduledRetry(state: ScreenshotQueryState | undefined): boolean {
  return state?.status === "retrying" || (state?.status === "failed" && !!state.recoverable);
}

export function isTerminalState(
  state: ScreenshotQueryState | undefined,
): state is TerminalScreenshotQueryState {
  return state?.status === "completed" || (state?.status === "failed" && !state.recoverable);
}

/** How long to wait before the next start/poll attempt, or `false` once settled. */
export function pollDelayMs(state: ScreenshotQueryState | undefined): number | false {
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
}
