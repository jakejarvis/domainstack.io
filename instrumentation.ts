import { waitUntil } from "@vercel/functions";
import { registerOTel } from "@vercel/otel";
import type { Instrumentation } from "next";

export const register = () => {
  registerOTel({ serviceName: "domainstack" });
};

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
) => {
  // Only track errors in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      // Dynamic imports for Node.js-only code
      const { getServerPosthog } = await import("@/lib/analytics/server");
      const phClient = getServerPosthog();

      if (!phClient) {
        return; // PostHog not available, skip error tracking
      }

      let distinctId: string | null = null;
      if (request.headers?.cookie) {
        const cookieString = request.headers.cookie;
        const postHogCookieMatch =
          typeof cookieString === "string"
            ? cookieString.match(/ph_phc_.*?_posthog=([^;]+)/)
            : null;

        if (postHogCookieMatch?.[1]) {
          try {
            const decodedCookie = decodeURIComponent(postHogCookieMatch[1]);
            const postHogData = JSON.parse(decodedCookie);
            distinctId = postHogData.distinct_id;
          } catch (err) {
            console.error(
              "[instrumentation] cookie parse error",
              err instanceof Error ? err : new Error(String(err)),
            );
          }
        }
      }

      phClient.captureException(err, distinctId || undefined, {
        path: request.path,
        method: request.method,
      });

      waitUntil?.(phClient.shutdown());
    } catch (trackingError) {
      // Graceful degradation - don't throw to avoid breaking the request
      console.error("[instrumentation] error tracking failed:", trackingError);
    }
  }
};
