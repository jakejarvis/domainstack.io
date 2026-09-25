import { describe, expect, it } from "vitest";

import { parseBlocklist } from "@/lib/blocklist";

describe("parseBlocklist", () => {
  it("parses plain and wildcard entries, lowercased", () => {
    expect(parseBlocklist("example.com\n*.Tracker.NET\nsub.domain.org")).toEqual([
      "example.com",
      "tracker.net",
      "sub.domain.org",
    ]);
  });

  it("skips blank lines and comments, and trims whitespace and CRLF", () => {
    expect(parseBlocklist("# OISD list\r\n\r\n   \n  spaced.com  \r\nlast.io\r\n")).toEqual([
      "spaced.com",
      "last.io",
    ]);
  });

  it("drops entries without an inner dot or with a leading or trailing dot", () => {
    expect(parseBlocklist("localhost\n.lead.com\ntrail.com.\n*.\nok.co")).toEqual(["ok.co"]);
  });

  it("drops entries with inner whitespace", () => {
    expect(parseBlocklist("bad entry.com\nbad\tentry.com\ngood.com")).toEqual(["good.com"]);
  });

  it("enforces the 3–253 character length bounds", () => {
    const longest = `${"a".repeat(249)}.com`; // 253
    const tooLong = `${"a".repeat(250)}.com`; // 254
    expect(parseBlocklist(["a.", "a.b", longest, tooLong].join("\n"))).toEqual(["a.b", longest]);
  });

  it("returns nothing for empty input", () => {
    expect(parseBlocklist("")).toEqual([]);
  });
});
