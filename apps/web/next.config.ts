import { withPostHogConfig } from "@posthog/nextjs-config";
import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

let nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  productionBrowserSourceMaps: true,
  serverExternalPackages: [
    // https://github.com/resend/react-email/issues/2426
    "prettier",
  ],
  outputFileTracingIncludes: {
    "/.well-known/workflow/v1/step": [
      "../../node_modules/@sparticuz/chromium/bin/**",
    ],
  },
  logging: {
    incomingRequests: {
      ignore: [/\/api\/trpc/, /\/.well-known\/workflow/],
    },
  },
  rewrites: async () => [
    // Rewrite /settings to default tab without a client-side navigation flash.
    // IMPORTANT: If the first tab ever changes, we also need to change this rewrite.
    {
      source: "/settings",
      destination: "/settings/subscription",
    },
    {
      source: "/dashboard/feed.ics",
      has: [
        {
          type: "query",
          key: "token",
        },
      ],
      destination: "/api/calendar/user?token=:token",
    },
    {
      source: "/_proxy/ingest/static/:path*",
      destination: "https://us-assets.i.posthog.com/static/:path*",
    },
    {
      source: "/_proxy/ingest/:path*",
      destination: "https://us.i.posthog.com/:path*",
    },
    {
      source: "/healthz",
      destination: "/api/healthz",
    },
  ],
  redirects: async () => [
    {
      source: "/bookmarklet",
      destination: "/bookmarklets",
      permanent: true,
    },
  ],
  skipTrailingSlashRedirect: true,
};

if (process.env.POSTHOG_API_KEY && process.env.POSTHOG_ENV_ID) {
  nextConfig = withPostHogConfig(nextConfig, {
    personalApiKey: process.env.POSTHOG_API_KEY,
    envId: process.env.POSTHOG_ENV_ID,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    logLevel: "error",
    sourcemaps: {
      enabled: true,
    },
  });
}

export default withWorkflow(nextConfig);
