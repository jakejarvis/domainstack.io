/**
 * Next.js rejects some requests before any application code runs and reports the
 * rejection through `onRequestError`. These are framework-level rejections, not
 * application bugs, so they must not reach error tracking.
 */
const FRAMEWORK_REJECTION_MESSAGES = [
  // Server Actions CSRF guard: Next.js rejects a POST whose `origin` header does
  // not match its `host`. The app declares no Server Actions, so every hit is a
  // scanner probing an endpoint the app does not expose.
  "Invalid Server Actions request.",
];

/**
 * Report whether a request error is a framework-level rejection that error
 * tracking must ignore.
 */
export function isFrameworkRequestError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return FRAMEWORK_REJECTION_MESSAGES.some((prefix) => message.startsWith(prefix));
}
