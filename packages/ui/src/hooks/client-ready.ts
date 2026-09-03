/**
 * Shared "first paint finished" flag for hydration-safe client snapshots.
 *
 * `useSyncExternalStore` may call `getSnapshot` during hydrate (React Compiler
 * and some Next.js 16 paths skip `getServerSnapshot`). Those snapshots must
 * still match the server until after the first frame.
 */

let ready = false;
const listeners = new Set<() => void>();
let cancelScheduled: (() => void) | null = null;

function notify(): void {
  ready = true;
  cancelScheduled = null;
  for (const listener of listeners) {
    listener();
  }
}

function scheduleReady(): void {
  if (ready || cancelScheduled !== null || typeof window === "undefined") {
    return;
  }

  if (typeof window.requestAnimationFrame === "function") {
    const frame = window.requestAnimationFrame(() => {
      cancelScheduled = null;
      if (!ready) {
        notify();
      }
    });
    cancelScheduled = () => {
      window.cancelAnimationFrame(frame);
      cancelScheduled = null;
    };
    return;
  }

  const timeout = window.setTimeout(() => {
    cancelScheduled = null;
    if (!ready) {
      notify();
    }
  }, 0);
  cancelScheduled = () => {
    window.clearTimeout(timeout);
    cancelScheduled = null;
  };
}

export function subscribeClientReady(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  scheduleReady();
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getClientReadySnapshot(): boolean {
  return ready;
}

export function getClientReadyServerSnapshot(): boolean {
  return false;
}

/** Test-only: pin or clear the shared ready flag. */
export function resetClientReady(value = false): void {
  cancelScheduled?.();
  cancelScheduled = null;
  ready = value;
  for (const listener of listeners) {
    listener();
  }
}
