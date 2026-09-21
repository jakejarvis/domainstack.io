import { describe, expect, it } from "vitest";

import { isInfraCaptureError } from "./workflow";

describe("isInfraCaptureError", () => {
  it.each([
    "Protocol error (Page.captureScreenshot): Target closed",
    "Session closed. Most likely the page has been closed.",
    "Navigation failed because browser has disconnected!",
    "WebSocket is not open: readyState 3 (CLOSED)",
    "Connection closed.",
  ])("treats %s as an infra failure, not a per-domain capture miss", (message) => {
    expect(isInfraCaptureError(new Error(message))).toBe(true);
  });

  it.each([
    "net::ERR_NAME_NOT_RESOLVED at https://nonexistent.example/",
    "net::ERR_CONNECTION_REFUSED at https://example.com/",
    "net::ERR_CERT_AUTHORITY_INVALID at https://example.com/",
    "Navigation timeout of 5000 ms exceeded",
  ])("treats %s as a per-domain capture failure, not infra", (message) => {
    expect(isInfraCaptureError(new Error(message))).toBe(false);
  });

  it("treats a non-Error throw by its stringified message", () => {
    expect(isInfraCaptureError("Target closed")).toBe(true);
    expect(isInfraCaptureError("net::ERR_NAME_NOT_RESOLVED")).toBe(false);
  });
});
