import { analytics } from "./analytics";

type GlobalErrorHandler = (error: Error, isFatal?: boolean) => void;

interface ErrorUtilsLike {
  getGlobalHandler(): GlobalErrorHandler;
  setGlobalHandler(handler: GlobalErrorHandler): void;
}

interface RejectionTrackingOptions {
  allRejections?: boolean;
  onUnhandled?: (id: string | number, error: unknown) => void;
  onHandled?: (id: string | number) => void;
}

interface RejectionTracking {
  enable(options: RejectionTrackingOptions): void;
}

interface HermesInternalLike {
  hasPromise?: () => boolean;
  enablePromiseRejectionTracker?: (options: RejectionTrackingOptions) => void;
}

let installed = false;

export function installGlobalErrorHandler() {
  if (installed) return;
  installed = true;

  const errorUtils = (globalThis as unknown as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (errorUtils) {
    const previousHandler = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      analytics.trackException(error, { fatal: Boolean(isFatal) });
      previousHandler(error, isFatal);
    });
  }

  // `allRejections: false` so only rejections still unhandled after the
  // detection delay are reported. `true` floods PostHog with rejections that
  // are handled a tick later (the no-op `onHandled` can't retract an
  // already-sent exception) — a constant stream of false positives in prod.
  const rejectionOptions: RejectionTrackingOptions = {
    allRejections: false,
    onHandled: () => {},
    onUnhandled: (_id, reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      analytics.trackException(error, { unhandledRejection: true });
    },
  };

  // Hermes (the default engine) provides its own native Promise, so the
  // JSC-only `promise` polyfill isn't bundled and `require`-ing it throws.
  // Hermes exposes an equivalent tracker — prefer it so unhandled rejections
  // are actually reported instead of silently dropped.
  const hermes = (globalThis as unknown as { HermesInternal?: HermesInternalLike }).HermesInternal;
  if (hermes?.hasPromise?.() && hermes.enablePromiseRejectionTracker) {
    hermes.enablePromiseRejectionTracker(rejectionOptions);
    return;
  }

  try {
    const rejectionTracking: RejectionTracking = require("promise/setimmediate/rejection-tracking");
    rejectionTracking.enable(rejectionOptions);
  } catch {
    // Non-Hermes engine without the promise polyfill — nothing to hook into.
  }
}
