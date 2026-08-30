import { describe, expect, it } from "vitest";

import { tokenizeJson } from "./json-highlight";

function reconstruct(lines: ReturnType<typeof tokenizeJson>): string {
  return lines.map((tokens) => tokens.map((token) => token.value).join("")).join("\n");
}

describe("tokenizeJson", () => {
  it("round-trips pretty-printed JSON including whitespace and punctuation", () => {
    const source = JSON.stringify(
      {
        ldhName: "example.com",
        status: ["client delete prohibited"],
        nameservers: [{ ldhName: "a.iana-servers.net" }],
        port43: null,
        secureDNS: { delegationSigned: false },
        events: [{ eventAction: "registration", eventDate: "1995-08-14T04:00:00Z" }],
        entities: [{ roles: ["registrar"], publicIds: [{ identifier: 123 }] }],
      },
      null,
      2,
    );

    expect(reconstruct(tokenizeJson(source))).toBe(source);
  });

  it("classifies keys, strings, numbers, booleans, and null", () => {
    const source = JSON.stringify(
      { url: "https://example.com:443", count: -2.5e3, ok: true, missing: null },
      null,
      2,
    );
    const tokens = tokenizeJson(source)
      .flat()
      .filter((token) => token.type !== "punctuation");

    expect(tokens).toEqual([
      { type: "key", value: '"url"' },
      { type: "string", value: '"https://example.com:443"' },
      { type: "key", value: '"count"' },
      { type: "number", value: "-2500" },
      { type: "key", value: '"ok"' },
      { type: "boolean", value: "true" },
      { type: "key", value: '"missing"' },
      { type: "null", value: "null" },
    ]);
  });

  it("keeps escaped quotes inside strings as a single token", () => {
    const source = JSON.stringify({ remark: 'He said "hello"' }, null, 2);
    const stringToken = tokenizeJson(source)
      .flat()
      .find((token) => token.type === "string");

    expect(stringToken?.value).toBe('"He said \\"hello\\""');
    expect(reconstruct(tokenizeJson(source))).toBe(source);
  });

  it("does not treat keyword prefixes as keywords", () => {
    const source = '{ "note": "nullish", "flag": trueish }';
    const tokens = tokenizeJson(source).flat();

    expect(tokens.some((token) => token.type === "null")).toBe(false);
    expect(tokens.some((token) => token.type === "boolean")).toBe(false);
    expect(reconstruct(tokenizeJson(source))).toBe(source);
  });
});
