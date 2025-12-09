import { describe, expect, it } from "vitest";
import {
  generateCorrelationId,
  getOrGenerateCorrelationId,
} from "./correlation";

describe("correlation", () => {
  describe("generateCorrelationId", () => {
    it("generates a UUID v4", () => {
      const id = generateCorrelationId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("generates unique IDs", () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("getOrGenerateCorrelationId", () => {
    it("extracts request ID from Vercel ID header", () => {
      const headers = new Headers();
      headers.set(
        "x-vercel-id",
        "iad1::sfo1::t7rxz-1765254901726-32fbe3710d68",
      );

      const id = getOrGenerateCorrelationId(headers);
      expect(id).toBe("t7rxz-1765254901726-32fbe3710d68");
    });

    it("handles Vercel ID with different regions", () => {
      const headers = new Headers();
      headers.set("x-vercel-id", "cle1::iad1::abc123-1234567890-xyz789");

      const id = getOrGenerateCorrelationId(headers);
      expect(id).toBe("abc123-1234567890-xyz789");
    });

    it("generates new ID when header is missing", () => {
      const headers = new Headers();

      const id = getOrGenerateCorrelationId(headers);
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("generates new ID when Vercel ID format is invalid", () => {
      const headers = new Headers();
      headers.set("x-vercel-id", "invalid-format");

      const id = getOrGenerateCorrelationId(headers);
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("generates new ID when Vercel ID ends with ::", () => {
      const headers = new Headers();
      headers.set("x-vercel-id", "iad1::sfo1::");

      const id = getOrGenerateCorrelationId(headers);
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("generates new ID when request ID part is empty", () => {
      const headers = new Headers();
      headers.set("x-vercel-id", "iad1::sfo1:: ");

      const id = getOrGenerateCorrelationId(headers);
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it("handles Vercel ID with no separator", () => {
      const headers = new Headers();
      headers.set("x-vercel-id", "just-a-simple-id");

      const id = getOrGenerateCorrelationId(headers);
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });
});
