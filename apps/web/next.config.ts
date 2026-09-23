import createMDX from "@next/mdx";
import { withPostHogConfig } from "@posthog/nextjs-config";
import createWithVercelToolbar from "@vercel/toolbar/plugins/next";
import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  reactCompiler: true,
  cacheComponents: true,
  partialPrefetching: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  productionBrowserSourceMaps: true,
  serverExternalPackages: [
    "@opentelemetry/api",
    "@opentelemetry/api-logs",
    "@opentelemetry/exporter-logs-otlp-http",
    "@opentelemetry/instrumentation",
    "@opentelemetry/resources",
    "@opentelemetry/sdk-logs",
    // https://github.com/resend/react-email/issues/2426
    "prettier",
  ],
  logging: {
    incomingRequests: {
      ignore: [/\/api\/trpc/, /\/.well-known\/workflow/],
    },
  },
  experimental: {
    globalNotFound: true,
    optimizePackageImports: [
      "@icons-pack/react-simple-icons",
      "@tabler/icons-react",
      "motion/react",
    ],
    staleTimes: {
      dynamic: 0,
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
      source: "/api/transport/mcp",
      destination: "/api/mcp",
    },
    {
      source: "/_proxy/ingest/static/:path*",
      destination: "https://us-assets.i.posthog.com/static/:path*",
    },
    {
      source: "/_proxy/ingest/array/:path*",
      destination: "https://us-assets.i.posthog.com/array/:path*",
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
  skipTrailingSlashRedirect: true,
};

const withVercelToolbar = createWithVercelToolbar();

const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm"],
    rehypePlugins: ["rehype-slug"],
  },
});

export default withPostHogConfig(withWorkflow(withVercelToolbar(withMDX(nextConfig))), {
  personalApiKey: process.env.POSTHOG_API_KEY!,
  projectId: process.env.POSTHOG_PROJECT_ID,
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
  logLevel: "error",
  sourcemaps: {
    enabled: Boolean(process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID),
    deleteAfterUpload: false,
  },
});
