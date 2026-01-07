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
  outputFileTracingIncludes: {
    "/.well-known/workflow/**/step": [
      "node_modules/@sparticuz/chromium/bin/**",
    ],
  },
  logging: {
    incomingRequests: {
      ignore: [/\/api\/inngest/],
    },
  },
  rewrites: async () => {
    return [
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
    ];
  },
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

// Wrap with Vercel Workflow for durable backend operations
// withWorkflow returns a phase function, which is the Next.js config format
export default withWorkflow(nextConfig);
