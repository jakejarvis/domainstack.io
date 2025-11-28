import type { Provider } from "@/lib/schemas";

/**
 * A registry of known hosting providers. The detection algorithm will iterate
 * through this list to identify the hosting provider from HTTP headers.
 */
export const HOSTING_PROVIDERS: Array<
  Omit<Provider, "category"> & { category: "hosting" }
> = [
  {
    name: "Vercel",
    domain: "vercel.com",
    category: "hosting",
    rule: {
      any: [
        { kind: "headerEquals", name: "server", value: "vercel" },
        { kind: "headerPresent", name: "x-vercel-id" },
      ],
    },
  },
  {
    name: "WP Engine",
    domain: "wpengine.com",
    category: "hosting",
    rule: { kind: "headerIncludes", name: "x-powered-by", substr: "wp engine" },
  },
  {
    name: "WordPress VIP",
    domain: "wpvip.com",
    category: "hosting",
    rule: {
      any: [
        {
          kind: "headerIncludes",
          name: "x-powered-by",
          substr: "wordpress vip",
        },
        {
          kind: "headerIncludes",
          name: "x-hacker",
          substr: "join.a8c.com/viphacker",
        },
      ],
    },
  },
  {
    name: "WordPress.com",
    domain: "wordpress.com",
    category: "hosting",
    rule: {
      any: [
        {
          kind: "headerIncludes",
          name: "host-header",
          substr: "wordpress.com",
        },
        {
          kind: "headerIncludes",
          name: "x-hacker",
          substr: "join.a8c.com/hacker",
        },
      ],
    },
  },
  {
    name: "Shopify",
    domain: "shopify.com",
    category: "hosting",
    rule: {
      any: [
        { kind: "headerIncludes", name: "powered-by", substr: "shopify" },
        { kind: "headerPresent", name: "x-shopid" },
      ],
    },
  },
  {
    name: "Amazon S3",
    domain: "aws.amazon.com",
    category: "hosting",
    rule: { kind: "headerEquals", name: "server", value: "amazons3" },
  },
  {
    name: "Netlify",
    domain: "netlify.com",
    category: "hosting",
    rule: {
      any: [
        { kind: "headerIncludes", name: "server", substr: "netlify" },
        { kind: "headerPresent", name: "x-nf-request-id" },
      ],
    },
  },
  {
    name: "GitHub Pages",
    domain: "docs.github.com",
    category: "hosting",
    rule: {
      any: [
        { kind: "headerPresent", name: "x-github-request-id" },
        { kind: "headerEquals", name: "server", value: "github.com" },
      ],
    },
  },
  {
    name: "GitLab Pages",
    domain: "gitlab.com",
    category: "hosting",
    rule: { kind: "headerEquals", name: "server", value: "gitlab pages" },
  },
  {
    name: "Fly.io",
    domain: "fly.io",
    category: "hosting",
    rule: {
      any: [
        { kind: "headerIncludes", name: "server", substr: "fly/" },
        { kind: "headerPresent", name: "fly-request-id" },
        { kind: "headerIncludes", name: "via", substr: "1.1 fly.io" },
      ],
    },
  },
  {
    name: "Heroku",
    domain: "heroku.com",
    category: "hosting",
    rule: {
      any: [
        { kind: "headerEquals", name: "server", value: "vegur" },
        { kind: "headerEquals", name: "server", value: "heroku" },
        { kind: "headerIncludes", name: "via", substr: "1.1 heroku-router" },
      ],
    },
  },
  {
    name: "Render",
    domain: "render.com",
    category: "hosting",
    rule: {
      any: [
        { kind: "headerEquals", name: "server", value: "render" },
        { kind: "headerPresent", name: "x-render-origin-server" },
      ],
    },
  },
  {
    name: "Squarespace",
    domain: "squarespace.com",
    category: "hosting",
    rule: { kind: "headerEquals", name: "server", value: "squarespace" },
  },
  {
    name: "Webflow",
    domain: "webflow.com",
    category: "hosting",
    rule: { kind: "headerPresent", name: "x-wf-page-id" },
  },
  {
    name: "Wix",
    domain: "wix.com",
    category: "hosting",
    rule: { kind: "headerPresent", name: "x-wix-request-id" },
  },
  {
    name: "Azure Front Door",
    domain: "azure.microsoft.com",
    category: "hosting",
    rule: { kind: "headerPresent", name: "x-azure-ref" },
  },
  {
    name: "Google Cloud",
    domain: "cloud.google.com",
    category: "hosting",
    rule: {
      any: [
        { kind: "headerEquals", name: "server", value: "google frontend" },
        { kind: "headerEquals", name: "server", value: "esf" },
        { kind: "headerEquals", name: "server", value: "gws" },
        { kind: "headerIncludes", name: "via", substr: "1.1 google" },
      ],
    },
  },
  {
    name: "Google Cloud Storage",
    domain: "cloud.google.com",
    category: "hosting",
    rule: { kind: "headerPresent", name: "x-goog-generation" },
  },
  {
    name: "Azure Static Web Apps",
    domain: "azure.microsoft.com",
    category: "hosting",
    rule: { kind: "headerPresent", name: "x-azure-ref" },
  },
  {
    name: "OVHcloud",
    domain: "ovhcloud.com",
    category: "hosting",
    rule: { kind: "headerPresent", name: "x-ovh-request-id" },
  },
  {
    name: "Pantheon",
    domain: "pantheon.io",
    category: "hosting",
    rule: {
      any: [
        { kind: "headerPresent", name: "x-pantheon-site" },
        { kind: "headerPresent", name: "x-pantheon-styx-hostname" },
        { kind: "headerPresent", name: "x-styx-req-id" },
      ],
    },
  },
  {
    name: "Sucuri",
    domain: "sucuri.net",
    category: "hosting",
    rule: { kind: "headerPresent", name: "x-sucuri-id" },
  },
  {
    name: "Imperva",
    domain: "imperva.com",
    category: "hosting",
    rule: { kind: "headerPresent", name: "x-iinfo" },
  },
  {
    name: "Kinsta",
    domain: "kinsta.com",
    category: "hosting",
    rule: { kind: "headerPresent", name: "x-kinsta-cache" },
  },
  {
    name: "Atlassian Statuspage",
    domain: "statuspage.io",
    category: "hosting",
    rule: { kind: "headerPresent", name: "x-statuspage-version" },
  },
  {
    name: "Railway",
    domain: "railway.app",
    category: "hosting",
    rule: {
      any: [
        { kind: "headerPresent", name: "x-railway-request-id" },
        { kind: "headerPresent", name: "x-railway-edge" },
        { kind: "headerIncludes", name: "server", substr: "railway" },
      ],
    },
  },
  {
    name: "Ghost",
    domain: "ghost.org",
    category: "hosting",
    rule: { kind: "headerPresent", name: "ghost-fastly" },
  },
  {
    name: "Substack",
    domain: "substack.com",
    category: "hosting",
    rule: {
      all: [
        { kind: "headerEquals", name: "x-served-by", value: "substack" },
        { kind: "headerPresent", name: "x-sub" },
      ],
    },
  },
  {
    name: "Bunny.net",
    domain: "bunny.net",
    category: "hosting",
    rule: {
      all: [
        { kind: "headerPresent", name: "cdn-cache" },
        { kind: "headerIncludes", name: "server", substr: "bunnycdn" },
      ],
    },
  },
  {
    name: "Fastly",
    domain: "fastly.com",
    category: "hosting",
    rule: {
      all: [
        { kind: "headerPresent", name: "x-served-by" },
        { kind: "headerPresent", name: "x-cache" },
        { kind: "headerPresent", name: "x-timer" },
      ],
    },
  },
  {
    name: "Akamai",
    domain: "akamai.com",
    category: "hosting",
    rule: {
      any: [
        { kind: "headerEquals", name: "server", value: "akamaighost" },
        { kind: "headerPresent", name: "x-akamai-transformed" },
        { kind: "headerPresent", name: "x-akamai-request-id" },
        { kind: "headerPresent", name: "akamai-request-bc" },
        { kind: "headerPresent", name: "akamai-grn" },
      ],
    },
  },
  {
    name: "Amazon CloudFront",
    domain: "aws.amazon.com",
    category: "hosting",
    rule: {
      any: [
        { kind: "headerEquals", name: "server", value: "cloudfront" },
        { kind: "headerPresent", name: "x-amz-cf-id" },
      ],
    },
  },
  {
    name: "Cloudflare",
    domain: "cloudflare.com",
    category: "hosting",
    rule: {
      all: [
        { kind: "headerEquals", name: "server", value: "cloudflare" },
        { kind: "headerPresent", name: "cf-ray" },
      ],
    },
  },
];
