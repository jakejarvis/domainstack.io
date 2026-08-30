import type { Metadata } from "next";

import { safeUrl } from "@/lib/safe-parse";

export const SITE_NAME = "Domainstack";
export const SITE_TAGLINE = "Domain Intelligence Made Easy";
export const SITE_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const SITE_DESCRIPTION =
  "Instant lookups for WHOIS, DNS, hosting, certificates, SEO and more, plus free domain tracking and change alerts.";

const openGraphDefaults = {
  type: "website",
  locale: "en_US",
  siteName: SITE_NAME,
} as const satisfies Metadata["openGraph"];

const twitterDefaults = {
  card: "summary_large_image",
} as const satisfies Metadata["twitter"];

export type CreateMetadataInput = {
  /**
   * Pathname for `rel=canonical` and `og:url`, e.g. `/help` or `/github.com`.
   * Resolved against `metadataBase` from the root layout.
   */
  path?: string;
} & Omit<Metadata, "metadataBase">;

function socialTitle(title: Metadata["title"]): string | undefined {
  if (typeof title === "string") return title;
  if (!title || typeof title !== "object") return undefined;
  if ("absolute" in title && title.absolute) return title.absolute;
  if ("default" in title && title.default) return title.default;
  return undefined;
}

/**
 * Builds page metadata with site-wide Open Graph / Twitter defaults applied.
 *
 * `title` and `description` are copied onto `og:*` and `twitter:*` unless the
 * page already set those fields. Next.js replaces parent `openGraph` and
 * `alternates` objects entirely when a child sets them, so every page should
 * go through this helper instead of relying on layout inheritance.
 */
export function createMetadata({
  path,
  title,
  description,
  openGraph,
  twitter,
  alternates,
  ...rest
}: CreateMetadataInput): Metadata {
  const canonical = alternates?.canonical ?? path;
  const ogTitle = socialTitle(title);

  return {
    ...rest,
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(canonical || alternates
      ? {
          alternates: {
            ...alternates,
            ...(canonical ? { canonical } : {}),
          },
        }
      : {}),
    openGraph: {
      ...openGraphDefaults,
      ...(path ? { url: path } : {}),
      ...(ogTitle ? { title: ogTitle } : {}),
      ...(description ? { description } : {}),
      ...openGraph,
    },
    twitter: {
      ...twitterDefaults,
      ...(ogTitle ? { title: ogTitle } : {}),
      ...(description ? { description } : {}),
      ...twitter,
    },
  };
}

export const notFoundMetadata = createMetadata({
  title: "Not Found",
  description: "The page you're looking for doesn't exist.",
  robots: {
    index: false,
    follow: false,
  },
});

export const rootMetadata: Metadata = {
  applicationName: SITE_NAME,
  title: {
    default: SITE_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase:
    safeUrl(process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000") ??
    new URL("http://localhost:3000"),
  openGraph: openGraphDefaults,
  twitter: twitterDefaults,
};
