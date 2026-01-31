import { describe, expect, it } from "vitest";
import { normalizeStatus, statusesAreEqual } from "./status";

describe("normalizeStatus", () => {
  it("converts to lowercase", () => {
    expect(normalizeStatus("ClientTransferProhibited")).toBe(
      "clienttransferprohibited",
    );
  });

  it("removes spaces", () => {
    expect(normalizeStatus("client transfer prohibited")).toBe(
      "clienttransferprohibited",
    );
  });

  it("removes underscores", () => {
    expect(normalizeStatus("client_transfer_prohibited")).toBe(
      "clienttransferprohibited",
    );
  });

  it("removes hyphens", () => {
    expect(normalizeStatus("client-transfer-prohibited")).toBe(
      "clienttransferprohibited",
    );
  });

  it("handles mixed separators", () => {
    expect(normalizeStatus("client_transfer-prohibited here")).toBe(
      "clienttransferprohibitedhere",
    );
  });

  it("trims whitespace", () => {
    expect(normalizeStatus("  active  ")).toBe("active");
  });
});

describe("statusesAreEqual", () => {
  it("returns true for identical arrays", () => {
    const a = ["active", "clientTransferProhibited"];
    const b = ["active", "clientTransferProhibited"];
    expect(statusesAreEqual(a, b)).toBe(true);
  });

  it("returns true for semantically equal arrays with different order", () => {
    const a = ["active", "clientTransferProhibited"];
    const b = ["clientTransferProhibited", "active"];
    expect(statusesAreEqual(a, b)).toBe(true);
  });

  it("returns true for semantically equal arrays with different formatting", () => {
    const a = ["clientTransferProhibited"];
    const b = ["client transfer prohibited"];
    expect(statusesAreEqual(a, b)).toBe(true);
  });

  it("returns false for arrays with different lengths", () => {
    const a = ["active"];
    const b = ["active", "clientTransferProhibited"];
    expect(statusesAreEqual(a, b)).toBe(false);
  });

  it("returns false for semantically different arrays", () => {
    const a = ["active"];
    const b = ["inactive"];
    expect(statusesAreEqual(a, b)).toBe(false);
  });

  it("handles empty arrays", () => {
    expect(statusesAreEqual([], [])).toBe(true);
    expect(statusesAreEqual(["active"], [])).toBe(false);
  });
});
