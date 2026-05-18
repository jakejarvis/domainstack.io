import { analytics } from "./analytics";

type GlobalErrorHandler = (error: Error, isFatal?: boolean) => void;

interface ErrorUtilsLike {
  getGlobalHandler(): GlobalErrorHandler;
  setGlobalHandler(handler: GlobalErrorHandler): void;
}

interface RejectionTracking {
  enable(options: {
    allRejections?: boolean;
    onUnhandled?: (id: string | number, error: unknown) => void;
    onHandled?: (id: string | number) => void;
  }): void;
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

  try {
    const rejectionTracking: RejectionTracking = require("promise/setimmediate/rejection-tracking");
    // `allRejections: false` so only rejections still unhandled after the
    // detection delay are reported. `true` floods PostHog with rejections that
    // are handled a tick later (the no-op `onHandled` can't retract an
    // already-sent exception) — a constant stream of false positives in prod.
    rejectionTracking.enable({
      allRejections: false,
      onHandled: () => {},
      onUnhandled: (_id, reason) => {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        analytics.trackException(error, { unhandledRejection: true });
      },
    });
  } catch {
    // promise polyfill not present — skip silently
  }
}
