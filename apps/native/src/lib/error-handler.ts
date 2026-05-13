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
    rejectionTracking.enable({
      allRejections: true,
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
