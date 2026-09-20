import { describe, expect, it } from "vitest";

import { buildHomeJsonLd } from "./json-ld";

describe("buildHomeJsonLd", () => {
  const jsonLd = buildHomeJsonLd("https://domainstack.io");
  const [website, webapp] = jsonLd["@graph"];

  it("declares the schema.org context and both nodes", () => {
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(website["@type"]).toBe("WebSite");
    expect(webapp["@type"]).toBe("WebApplication");
  });

  it("points the search action at the /?q= redirect", () => {
    expect(website.potentialAction?.target).toBe("https://domainstack.io/?q={query}");
  });

  it("uses a category from Google's supported application list", () => {
    expect(webapp.applicationCategory).toBe("UtilitiesApplication");
  });

  it("links the app to its repository and social profiles via sameAs", () => {
    expect(webapp.sameAs).toEqual([
      "https://github.com/jakejarvis/domainstack.io",
      "https://bsky.app/profile/domainstack.io",
      "https://x.com/getdomainstack",
    ]);
  });

  it("gives every node a unique absolute @id", () => {
    const ids = [website["@id"], webapp["@id"]];
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(id).toMatch(/^https:\/\/domainstack\.io\/#/);
  });
});
