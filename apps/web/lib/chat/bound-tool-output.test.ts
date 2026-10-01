/* @vitest-environment node */
import { describe, expect, it } from "vitest";

import { boundToolOutput, TOOL_OUTPUT_LIMITS, TRUNCATION_MARKER } from "./bound-tool-output";

describe("boundToolOutput", () => {
  it("truncates long strings with a visible marker", () => {
    const result = boundToolOutput("a".repeat(5_000));

    expect(result).toHaveLength(TOOL_OUTPUT_LIMITS.maxString + TRUNCATION_MARKER.length);
    expect(result.endsWith(TRUNCATION_MARKER)).toBe(true);
  });

  it("caps arrays at the first maxArray items", () => {
    const result = boundToolOutput(Array.from({ length: 500 }, (_, i) => i));

    expect(result).toHaveLength(TOOL_OUTPUT_LIMITS.maxArray);
    expect(result[0]).toBe(0);
    expect(result.at(-1)).toBe(TOOL_OUTPUT_LIMITS.maxArray - 1);
  });

  it("bounds nested objects and arrays at every level", () => {
    const long = "x".repeat(2_000);
    const result = boundToolOutput({
      a: { b: [{ c: long }, long] },
      list: Array.from({ length: 300 }, () => long),
    });

    expect((result.a.b[0] as { c: string }).c.endsWith(TRUNCATION_MARKER)).toBe(true);
    expect((result.a.b[1] as string).endsWith(TRUNCATION_MARKER)).toBe(true);
    expect(result.list).toHaveLength(TOOL_OUTPUT_LIMITS.maxArray);
    expect(result.list[0]?.endsWith(TRUNCATION_MARKER)).toBe(true);
  });

  it("replaces nesting past maxDepth with the marker", () => {
    let deep: Record<string, unknown> = { leaf: "ok" };
    for (let i = 0; i < 20; i++) deep = { next: deep };

    expect(JSON.stringify(boundToolOutput(deep))).toContain(TRUNCATION_MARKER);
  });

  it("leaves dates, numbers, booleans and null unchanged", () => {
    const date = new Date("2026-01-01T00:00:00Z");

    expect(boundToolOutput({ date, n: 1, ok: true, none: null })).toEqual({
      date,
      n: 1,
      ok: true,
      none: null,
    });
    expect(boundToolOutput({ date }).date).toBeInstanceOf(Date);
  });

  it("does not mutate its input", () => {
    const input = { list: Array.from({ length: 200 }, () => "y".repeat(2_000)) };
    const snapshot = structuredClone(input);

    boundToolOutput(input);

    expect(input).toEqual(snapshot);
  });

  it("returns a small realistic payload unchanged", () => {
    const dns = {
      records: [
        { type: "A", name: "example.com", value: "93.184.216.34", ttl: 300 },
        { type: "MX", name: "example.com", value: "mail.example.com", priority: 10, ttl: 3600 },
      ],
      resolver: "cloudflare",
      fetchedAt: new Date("2026-01-01T00:00:00Z"),
    };

    expect(boundToolOutput(dns)).toEqual(dns);
  });
});
