"use client";

import { useEffect, useState } from "react";

function detectIsMac(): boolean {
  if (typeof navigator === "undefined") return false;
  try {
    const nav = navigator as unknown as {
      platform?: string;
      userAgent?: string;
      userAgentData?: { platform?: string };
    };
    const platform = nav.userAgentData?.platform || nav.platform || "";
    const ua = nav.userAgent || "";
    return (
      /Mac|Macintosh|MacIntel|MacPPC|Mac68K/i.test(platform) ||
      /Mac OS X/i.test(ua)
    );
  } catch {
    return false;
  }
}

export function useIsMac() {
  // Initialize to false to guarantee SSR and first client render match.
  const [isMac, setIsMac] = useState<boolean>(false);

  // Re-evaluate after mount to capture accurate client info (e.g., UA hints)
  useEffect(() => {
    setIsMac(detectIsMac());
  }, []);

  return isMac;
}
