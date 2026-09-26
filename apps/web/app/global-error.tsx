"use client";

import NextError from "next/error";
import posthogClient from "posthog-js";
import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    posthogClient.captureException(error);
  }, [error]);

  return (
    // global-error must include html and body tags
    <html lang="en">
      <body>
        {/* `NextError` is the default Next.js error page component */}
        <NextError statusCode={0} />
        <div style={{ textAlign: "center" }}>
          <button type="button" onClick={() => retry()}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
