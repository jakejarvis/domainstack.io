import { describe, expect, it } from "vitest";
import { isPrivateIp } from "./ip";

describe("isPrivateIp", () => {
  it("returns true for localhost IPv4", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
  });

  it("returns true for localhost IPv6", () => {
    expect(isPrivateIp("::1")).toBe(true);
  });

  it("returns true for private IPv4 ranges", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
  });

  it("returns true for link-local addresses", () => {
    expect(isPrivateIp("169.254.1.1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
  });

  it("returns false for public IPv4 addresses", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("142.250.80.46")).toBe(false);
  });

  it("returns false for public IPv6 addresses", () => {
    expect(isPrivateIp("2001:4860:4860::8888")).toBe(false);
  });

  it("returns true for invalid IP addresses", () => {
    expect(isPrivateIp("not-an-ip")).toBe(true);
    expect(isPrivateIp("")).toBe(true);
  });

  it("returns true for special-use addresses", () => {
    expect(isPrivateIp("0.0.0.0")).toBe(true);
    expect(isPrivateIp("255.255.255.255")).toBe(true);
  });
});
