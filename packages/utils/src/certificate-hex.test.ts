import { describe, expect, it } from "vitest";

import { normalizeCertificateHex } from "./certificate-hex";

describe("normalizeCertificateHex", () => {
  it("strips colons and lowercases", () => {
    expect(normalizeCertificateHex("A1:B2:C3:D4")).toBe("a1b2c3d4");
  });

  it("returns null for missing values", () => {
    expect(normalizeCertificateHex(undefined)).toBeNull();
    expect(normalizeCertificateHex(null)).toBeNull();
    expect(normalizeCertificateHex("")).toBeNull();
  });

  it("is a no-op for already-normalized values", () => {
    expect(normalizeCertificateHex("a1b2c3d4")).toBe("a1b2c3d4");
  });
});
