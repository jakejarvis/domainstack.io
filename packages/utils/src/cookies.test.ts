import { describe, expect, it } from "vitest";

import { parseSetCookieHeaders } from "./cookies";

describe("parseSetCookieHeaders", () => {
  it("parses a simple name=value pair", () => {
    expect(parseSetCookieHeaders(["sid=abc123"])).toEqual({ sid: "abc123" });
  });

  it("strips attributes after the first semicolon", () => {
    expect(parseSetCookieHeaders(["sid=abc123; Path=/; HttpOnly; Secure"])).toEqual({
      sid: "abc123",
    });
  });

  it("keeps an = sign inside the value", () => {
    expect(parseSetCookieHeaders(["token=abc=def=ghi; Path=/"])).toEqual({
      token: "abc=def=ghi",
    });
  });

  it("keeps commas inside the value", () => {
    expect(parseSetCookieHeaders(["list=a,b,c; Path=/"])).toEqual({ list: "a,b,c" });
  });

  it("skips a malformed entry with no =", () => {
    expect(parseSetCookieHeaders(["not-a-cookie"])).toEqual({});
  });

  it("skips an entry starting with =", () => {
    expect(parseSetCookieHeaders(["=value; Path=/"])).toEqual({});
  });

  it("lowercases cookie names", () => {
    expect(parseSetCookieHeaders(["PHPSESSID=xyz"])).toEqual({ phpsessid: "xyz" });
  });

  it("lets the last duplicate name win", () => {
    expect(parseSetCookieHeaders(["sid=first", "sid=second"])).toEqual({ sid: "second" });
  });

  it("returns an empty object for an empty input array", () => {
    expect(parseSetCookieHeaders([])).toEqual({});
  });
});
