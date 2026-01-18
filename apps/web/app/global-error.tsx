"use client";

import NextError from "next/error";
import { useEffect } from "react";
import { analytics } from "@/lib/analytics/client";

export default function GlobalError({
  error,
  reset: _reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    analytics.trackException(error);
  }, [error]);

  return (
    // global-error must include html and body tags
    <html lang="en">
      <body>
        {/* `NextError` is the default Next.js error page component */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
