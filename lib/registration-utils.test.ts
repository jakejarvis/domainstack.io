import { describe, expect, it } from "vitest";
import { normalizeStatus, statusesAreEqual } from "./registration-utils";

describe("normalizeStatus", () => {
  it("normalizes camelCase to lowercase", () => {
    expect(normalizeStatus("clientTransferProhibited")).toBe(
      "clienttransferprohibited",
    );
    expect(normalizeStatus("serverDeleteProhibited")).toBe(
      "serverdeleteprohibited",
    );
  });

  it("normalizes space-separated to lowercase without spaces", () => {
    expect(normalizeStatus("client transfer prohibited")).toBe(
      "clienttransferprohibited",
    );
    expect(normalizeStatus("server delete prohibited")).toBe(
      "serverdeleteprohibited",
    );
  });

  it("normalizes underscore-separated to lowercase without underscores", () => {
    expect(normalizeStatus("client_transfer_prohibited")).toBe(
      "clienttransferprohibited",
    );
  });

  it("normalizes hyphen-separated to lowercase without hyphens", () => {
    expect(normalizeStatus("client-transfer-prohibited")).toBe(
      "clienttransferprohibited",
    );
  });

  it("handles mixed separators", () => {
    expect(normalizeStatus("client_transfer-prohibited")).toBe(
      "clienttransferprohibited",
    );
  });

  it("handles already lowercase values", () => {
    expect(normalizeStatus("active")).toBe("active");
    expect(normalizeStatus("ok")).toBe("ok");
  });

  it("handles uppercase values", () => {
    expect(normalizeStatus("ACTIVE")).toBe("active");
    expect(normalizeStatus("OK")).toBe("ok");
  });

  it("trims whitespace", () => {
    expect(normalizeStatus("  active  ")).toBe("active");
  });
});

describe("statusesAreEqual", () => {
  it("returns true for identical arrays", () => {
    expect(
      statusesAreEqual(
        ["clientTransferProhibited", "ok"],
        ["clientTransferProhibited", "ok"],
      ),
    ).toBe(true);
  });

  it("returns true for semantically equal arrays with different formatting", () => {
    expect(
      statusesAreEqual(
        ["clientTransferProhibited"],
        ["client transfer prohibited"],
      ),
    ).toBe(true);
  });

  it("returns true for semantically equal arrays with different order", () => {
    expect(
      statusesAreEqual(
        ["ok", "clientTransferProhibited"],
        ["clientTransferProhibited", "ok"],
      ),
    ).toBe(true);
  });

  it("returns true for semantically equal arrays with different order and formatting", () => {
    expect(
      statusesAreEqual(
        ["ok", "clientTransferProhibited", "serverDeleteProhibited"],
        ["server delete prohibited", "client transfer prohibited", "OK"],
      ),
    ).toBe(true);
  });

  it("returns false for arrays with different lengths", () => {
    expect(
      statusesAreEqual(
        ["clientTransferProhibited", "ok"],
        ["clientTransferProhibited"],
      ),
    ).toBe(false);
  });

  it("returns false for arrays with different values", () => {
    expect(
      statusesAreEqual(
        ["clientTransferProhibited"],
        ["clientDeleteProhibited"],
      ),
    ).toBe(false);
  });

  it("returns true for empty arrays", () => {
    expect(statusesAreEqual([], [])).toBe(true);
  });

  it("returns false when only one array is empty", () => {
    expect(statusesAreEqual(["ok"], [])).toBe(false);
    expect(statusesAreEqual([], ["ok"])).toBe(false);
  });
});
