import { describe, expect, it } from "vitest";

import { SITE_NAME, SITE_TITLE, createMetadata, notFoundMetadata, rootMetadata } from "./seo";

describe("createMetadata", () => {
  it("sets canonical and og:url from the page path", () => {
    const metadata = createMetadata({
      path: "/help",
      title: "Help & FAQ",
      description: "Answers to common questions.",
    });

    expect(metadata.title).toBe("Help & FAQ");
    expect(metadata.description).toBe("Answers to common questions.");
    expect(metadata.alternates?.canonical).toBe("/help");
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      locale: "en_US",
      siteName: SITE_NAME,
      url: "/help",
      title: "Help & FAQ",
      description: "Answers to common questions.",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Help & FAQ",
      description: "Answers to common questions.",
    });
  });

  it("copies absolute titles onto Open Graph and Twitter", () => {
    const metadata = createMetadata({
      path: "/example.com",
      title: { absolute: "example.com — Domain Report" },
      description: "A domain report.",
    });

    expect(metadata.openGraph).toMatchObject({
      title: "example.com — Domain Report",
      description: "A domain report.",
    });
    expect(metadata.twitter).toMatchObject({
      title: "example.com — Domain Report",
      description: "A domain report.",
    });
  });

  it("lets page-level Open Graph and Twitter fields override defaults", () => {
    const metadata = createMetadata({
      path: "/example.com",
      title: { absolute: "example.com — Domain Report" },
      description: "A domain report.",
      openGraph: {
        title: "Custom OG title",
        description: "Custom OG description",
        images: [{ url: "/api/og?domain=example.com" }],
      },
      twitter: {
        title: "Custom Twitter title",
        images: ["/api/og?domain=example.com"],
      },
    });

    expect(metadata.openGraph).toMatchObject({
      siteName: SITE_NAME,
      type: "website",
      url: "/example.com",
      title: "Custom OG title",
      description: "Custom OG description",
      images: [{ url: "/api/og?domain=example.com" }],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Custom Twitter title",
      description: "A domain report.",
      images: ["/api/og?domain=example.com"],
    });
  });

  it("omits canonical and og:url when no path is provided", () => {
    const metadata = createMetadata({
      title: "Not Found",
      robots: { index: false, follow: false },
    });

    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toMatchObject({
      siteName: SITE_NAME,
      title: "Not Found",
    });
    expect(metadata.openGraph).not.toHaveProperty("url");
  });
});

describe("root metadata", () => {
  it("does not pin a site-wide canonical", () => {
    expect(rootMetadata.applicationName).toBe(SITE_NAME);
    expect(rootMetadata.title).toEqual({
      default: SITE_TITLE,
      template: `%s — ${SITE_NAME}`,
    });
    expect(rootMetadata.alternates).toBeUndefined();
    expect(rootMetadata.openGraph).toEqual({
      type: "website",
      locale: "en_US",
      siteName: SITE_NAME,
    });
  });
});

describe("not-found metadata", () => {
  it("marks the page as noindex", () => {
    expect(notFoundMetadata.robots).toEqual({
      index: false,
      follow: false,
    });
    expect(notFoundMetadata.openGraph).toMatchObject({
      title: "Not Found",
      description: "The page you're looking for doesn't exist.",
    });
  });
});
