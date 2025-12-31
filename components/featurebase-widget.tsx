"use client";

import Script from "next/script";
import { useEffect } from "react";
import { useTheme } from "@/hooks/use-theme";

export function FeaturebaseWidget({
  jwtToken,
  routeSyncingBasePath,
}: {
  jwtToken?: string;
  routeSyncingBasePath?: string;
}) {
  const { theme } = useTheme();

  // biome-ignore lint/correctness/useExhaustiveDependencies: we don't want to reset the entire widget when the theme changes
  useEffect(() => {
    // biome-ignore lint/suspicious/noExplicitAny: we need to assign to the window object
    const win = window as any;

    if (typeof win.Featurebase !== "function") {
      win.Featurebase = function () {
        // biome-ignore lint/suspicious/noAssignInExpressions: we need to assign to the window object
        // biome-ignore lint/complexity/noArguments: we need to push arguments to the window object
        (win.Featurebase.q = win.Featurebase.q || []).push(arguments);
      };
    }

    if (jwtToken) {
      win.Featurebase("identify", {
        organization: "domainstack",
        featurebaseJwt: jwtToken,
      });
    }

    win.Featurebase("init_embed_widget", {
      organization: "domainstack",
      embedOptions: {
        path: "/",
        // filters: "",
        routeSyncingBasePath: routeSyncingBasePath || "",
      },
      stylingOptions: {
        theme,
        hideMenu: true,
        hideLogo: true,
      },
    });
  }, []);

  return (
    <>
      <Script src="https://do.featurebase.app/js/sdk.js" id="featurebase-sdk" />
      <div data-featurebase-embed></div>
    </>
  );
}
