/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { TechDetectionContext, TechRule } from "./rules";
import { evalTechRule } from "./rules";

const emptyContext: TechDetectionContext = {
  url: "",
  html: "",
  headers: {},
  cookies: {},
  meta: {},
  scriptSrc: [],
  dnsTxt: [],
};

describe("evalTechRule", () => {
  describe("headerPresent", () => {
    it("matches when header exists", () => {
      const rule: TechRule = { kind: "headerPresent", name: "x-vercel-id" };
      const ctx: TechDetectionContext = { ...emptyContext, headers: { "x-vercel-id": "abc" } };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.signals).toEqual(["header"]);
      expect(result.version).toBeNull();
    });

    it("does not match when header is absent", () => {
      const rule: TechRule = { kind: "headerPresent", name: "x-vercel-id" };
      expect(evalTechRule(rule, emptyContext).matched).toBe(false);
    });
  });

  describe("headerRegex", () => {
    it("matches and captures a version", () => {
      const rule: TechRule = {
        kind: "headerRegex",
        name: "server",
        pattern: "^nginx/([\\d.]+)",
        version: 1,
      };
      const ctx: TechDetectionContext = { ...emptyContext, headers: { server: "nginx/1.18.0" } };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.version).toBe("1.18.0");
      expect(result.signals).toEqual(["header"]);
    });

    it("does not match a different value", () => {
      const rule: TechRule = { kind: "headerRegex", name: "server", pattern: "^nginx" };
      const ctx: TechDetectionContext = { ...emptyContext, headers: { server: "Apache" } };
      expect(evalTechRule(rule, ctx).matched).toBe(false);
    });
  });

  describe("cookiePresent", () => {
    it("matches when cookie exists", () => {
      const rule: TechRule = { kind: "cookiePresent", name: "phpsessid" };
      const ctx: TechDetectionContext = { ...emptyContext, cookies: { phpsessid: "abc" } };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.signals).toEqual(["cookie"]);
    });

    it("does not match when cookie is absent", () => {
      const rule: TechRule = { kind: "cookiePresent", name: "phpsessid" };
      expect(evalTechRule(rule, emptyContext).matched).toBe(false);
    });
  });

  describe("cookieRegex", () => {
    it("matches and captures a version", () => {
      const rule: TechRule = {
        kind: "cookieRegex",
        name: "session",
        pattern: "^v([\\d]+)-",
        version: 1,
      };
      const ctx: TechDetectionContext = { ...emptyContext, cookies: { session: "v2-abc" } };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.version).toBe("2");
    });

    it("does not match when the pattern fails", () => {
      const rule: TechRule = { kind: "cookieRegex", name: "session", pattern: "^v\\d+-" };
      const ctx: TechDetectionContext = { ...emptyContext, cookies: { session: "abc" } };
      expect(evalTechRule(rule, ctx).matched).toBe(false);
    });
  });

  describe("metaPresent", () => {
    it("matches when meta name exists", () => {
      const rule: TechRule = { kind: "metaPresent", name: "generator" };
      const ctx: TechDetectionContext = { ...emptyContext, meta: { generator: ["WordPress"] } };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.signals).toEqual(["meta"]);
    });

    it("does not match when meta name is absent", () => {
      const rule: TechRule = { kind: "metaPresent", name: "generator" };
      expect(evalTechRule(rule, emptyContext).matched).toBe(false);
    });
  });

  describe("metaRegex", () => {
    it("matches against any content value for that meta name", () => {
      const rule: TechRule = {
        kind: "metaRegex",
        name: "generator",
        pattern: "^WordPress\\s+([\\d.]+)",
        version: 1,
      };
      const ctx: TechDetectionContext = {
        ...emptyContext,
        meta: { generator: ["Some Other Thing", "WordPress 6.4"] },
      };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.version).toBe("6.4");
    });

    it("does not match when no content value matches", () => {
      const rule: TechRule = { kind: "metaRegex", name: "generator", pattern: "^Drupal" };
      const ctx: TechDetectionContext = { ...emptyContext, meta: { generator: ["WordPress"] } };
      expect(evalTechRule(rule, ctx).matched).toBe(false);
    });
  });

  describe("htmlRegex", () => {
    it("matches and captures a version from the html body", () => {
      const rule: TechRule = {
        kind: "htmlRegex",
        pattern: 'ng-version="([\\d.]+)"',
        version: 1,
      };
      const ctx: TechDetectionContext = { ...emptyContext, html: '<html ng-version="17.0.0">' };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.version).toBe("17.0.0");
      expect(result.signals).toEqual(["html"]);
    });

    it("does not match unrelated html", () => {
      const rule: TechRule = { kind: "htmlRegex", pattern: "wp-content" };
      const ctx: TechDetectionContext = { ...emptyContext, html: "<html></html>" };
      expect(evalTechRule(rule, ctx).matched).toBe(false);
    });
  });

  describe("scriptSrcRegex", () => {
    it("matches and captures a version from any script src", () => {
      const rule: TechRule = {
        kind: "scriptSrcRegex",
        pattern: "jquery-([\\d.]+)\\.min\\.js",
        version: 1,
      };
      const ctx: TechDetectionContext = {
        ...emptyContext,
        scriptSrc: ["https://example.com/app.js", "https://cdn.example.com/jquery-3.7.1.min.js"],
      };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.version).toBe("3.7.1");
      expect(result.signals).toEqual(["scriptSrc"]);
    });

    it("does not match when no script src matches", () => {
      const rule: TechRule = { kind: "scriptSrcRegex", pattern: "jquery" };
      const ctx: TechDetectionContext = {
        ...emptyContext,
        scriptSrc: ["https://example.com/app.js"],
      };
      expect(evalTechRule(rule, ctx).matched).toBe(false);
    });
  });

  describe("urlRegex", () => {
    it("matches against the final url", () => {
      const rule: TechRule = { kind: "urlRegex", pattern: "^https://checkout\\." };
      const ctx: TechDetectionContext = { ...emptyContext, url: "https://checkout.example.com" };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.signals).toEqual(["url"]);
    });

    it("does not match a different url", () => {
      const rule: TechRule = { kind: "urlRegex", pattern: "^https://checkout\\." };
      const ctx: TechDetectionContext = { ...emptyContext, url: "https://example.com" };
      expect(evalTechRule(rule, ctx).matched).toBe(false);
    });
  });

  describe("dnsTxtRegex", () => {
    it("matches and captures from any TXT record value", () => {
      const rule: TechRule = {
        kind: "dnsTxtRegex",
        pattern: "^MS=(ms\\d+)",
        version: 1,
      };
      const ctx: TechDetectionContext = {
        ...emptyContext,
        dnsTxt: ["v=spf1 include:_spf.google.com ~all", "MS=ms12345678"],
      };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.version).toBe("ms12345678");
      expect(result.signals).toEqual(["dnsTxt"]);
    });

    it("does not match when no TXT record matches", () => {
      const rule: TechRule = { kind: "dnsTxtRegex", pattern: "^MS=" };
      const ctx: TechDetectionContext = { ...emptyContext, dnsTxt: ["v=spf1 ~all"] };
      expect(evalTechRule(rule, ctx).matched).toBe(false);
    });
  });

  describe("jsGlobal", () => {
    it("never matches when ctx.js is undefined", () => {
      const rule: TechRule = { kind: "jsGlobal", path: "React.version" };
      expect(evalTechRule(rule, emptyContext).matched).toBe(false);
    });

    it("never matches when ctx.js is empty", () => {
      const rule: TechRule = { kind: "jsGlobal", path: "React.version" };
      const ctx: TechDetectionContext = { ...emptyContext, js: {} };
      expect(evalTechRule(rule, ctx).matched).toBe(false);
    });

    it("matches presence when no pattern is given", () => {
      const rule: TechRule = { kind: "jsGlobal", path: "React.version" };
      const ctx: TechDetectionContext = { ...emptyContext, js: { "React.version": "18.2.0" } };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.signals).toEqual(["jsGlobal"]);
    });

    it("captures a version when a pattern is given", () => {
      const rule: TechRule = {
        kind: "jsGlobal",
        path: "React.version",
        pattern: "^(.+)$",
        version: 1,
      };
      const ctx: TechDetectionContext = { ...emptyContext, js: { "React.version": "18.2.0" } };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.version).toBe("18.2.0");
    });
  });

  describe("case sensitivity of names", () => {
    it("looks up headers case-insensitively", () => {
      const rule: TechRule = { kind: "headerPresent", name: "X-Vercel-ID" };
      const ctx: TechDetectionContext = { ...emptyContext, headers: { "x-vercel-id": "abc" } };
      expect(evalTechRule(rule, ctx).matched).toBe(true);
    });

    it("looks up cookies case-insensitively", () => {
      const rule: TechRule = { kind: "cookiePresent", name: "PHPSESSID" };
      const ctx: TechDetectionContext = { ...emptyContext, cookies: { phpsessid: "abc" } };
      expect(evalTechRule(rule, ctx).matched).toBe(true);
    });

    it("looks up meta names case-insensitively", () => {
      const rule: TechRule = { kind: "metaPresent", name: "Generator" };
      const ctx: TechDetectionContext = { ...emptyContext, meta: { generator: ["x"] } };
      expect(evalTechRule(rule, ctx).matched).toBe(true);
    });
  });

  describe("Object.hasOwn semantics", () => {
    it("does not match inherited Object.prototype keys for headers", () => {
      const rule: TechRule = { kind: "headerPresent", name: "constructor" };
      expect(evalTechRule(rule, emptyContext).matched).toBe(false);
    });

    it("does not match inherited Object.prototype keys for cookies", () => {
      const rule: TechRule = { kind: "cookiePresent", name: "constructor" };
      expect(evalTechRule(rule, emptyContext).matched).toBe(false);
    });

    it("does not match inherited Object.prototype keys for meta", () => {
      const rule: TechRule = { kind: "metaPresent", name: "constructor" };
      expect(evalTechRule(rule, emptyContext).matched).toBe(false);
    });
  });

  describe("version extraction", () => {
    it("yields no version when the capturing group did not participate", () => {
      const rule: TechRule = {
        kind: "htmlRegex",
        pattern: "foo(?:-(bar))?",
        version: 1,
      };
      const ctx: TechDetectionContext = { ...emptyContext, html: "foo" };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.version).toBeNull();
    });

    it("trims version whitespace", () => {
      const rule: TechRule = {
        kind: "htmlRegex",
        pattern: "version:(\\s*[\\d.]+\\s*)",
        version: 1,
      };
      const ctx: TechDetectionContext = { ...emptyContext, html: "version: 1.2.3 " };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.version).toBe("1.2.3");
    });

    it("yields null for an all-whitespace capture", () => {
      const rule: TechRule = {
        kind: "htmlRegex",
        pattern: "foo(\\s*)bar",
        version: 1,
      };
      const ctx: TechDetectionContext = { ...emptyContext, html: "foobar" };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.version).toBeNull();
    });
  });

  describe("any combinator", () => {
    it("short-circuits on the first matching child", () => {
      const rule: TechRule = {
        any: [
          { kind: "htmlRegex", pattern: "no-version-here" },
          { kind: "htmlRegex", pattern: "version-([\\d.]+)", version: 1 },
        ],
      };
      const ctx: TechDetectionContext = { ...emptyContext, html: "version-1.2.3" };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      // The first child (no version capture) matched conceptually? No - it
      // didn't match "no-version-here" against this html, so the second
      // child is the one that matches and contributes its version.
      expect(result.version).toBe("1.2.3");
    });

    it("does not evaluate the version-capturing branch when an earlier branch already matched", () => {
      const rule: TechRule = {
        any: [
          { kind: "htmlRegex", pattern: "marker" },
          { kind: "htmlRegex", pattern: "marker-([\\d.]+)", version: 1 },
        ],
      };
      const ctx: TechDetectionContext = { ...emptyContext, html: "marker-1.2.3" };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      // First branch matches "marker" (substring of "marker-1.2.3") and wins,
      // so no version is captured even though the second branch would have.
      expect(result.version).toBeNull();
    });

    it("returns no match when no child matches", () => {
      const rule: TechRule = { any: [{ kind: "htmlRegex", pattern: "nope" }] };
      const ctx: TechDetectionContext = { ...emptyContext, html: "unrelated" };
      expect(evalTechRule(rule, ctx).matched).toBe(false);
    });
  });

  describe("all combinator", () => {
    it("takes the first non-null version and unions signals", () => {
      const rule: TechRule = {
        all: [
          { kind: "headerPresent", name: "x-required" },
          { kind: "htmlRegex", pattern: "v([\\d.]+)", version: 1 },
        ],
      };
      const ctx: TechDetectionContext = {
        ...emptyContext,
        headers: { "x-required": "1" },
        html: "v2.0.0",
      };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.version).toBe("2.0.0");
      expect(result.signals).toEqual(["header", "html"]);
    });

    it("returns no match when any child fails", () => {
      const rule: TechRule = {
        all: [
          { kind: "headerPresent", name: "x-required" },
          { kind: "htmlRegex", pattern: "v[\\d.]+" },
        ],
      };
      const ctx: TechDetectionContext = { ...emptyContext, html: "v2.0.0" };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(false);
      expect(result.version).toBeNull();
      expect(result.signals).toEqual([]);
    });
  });

  describe("not combinator", () => {
    it("inverts the match and contributes neither version nor signals", () => {
      const rule: TechRule = {
        not: { kind: "htmlRegex", pattern: "v([\\d.]+)", version: 1 },
      };
      const ctx: TechDetectionContext = { ...emptyContext, html: "unrelated" };
      const result = evalTechRule(rule, ctx);
      expect(result.matched).toBe(true);
      expect(result.version).toBeNull();
      expect(result.signals).toEqual([]);
    });

    it("returns false when the inner rule matches", () => {
      const rule: TechRule = {
        not: { kind: "htmlRegex", pattern: "v[\\d.]+" },
      };
      const ctx: TechDetectionContext = { ...emptyContext, html: "v2.0.0" };
      expect(evalTechRule(rule, ctx).matched).toBe(false);
    });
  });

  describe("invalid regex", () => {
    it("returns no match instead of throwing", () => {
      const rule: TechRule = { kind: "htmlRegex", pattern: "(" };
      expect(() => evalTechRule(rule, emptyContext)).not.toThrow();
      expect(evalTechRule(rule, emptyContext).matched).toBe(false);
    });
  });
});
