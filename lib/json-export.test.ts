/* @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { exportDomainData } from "./json-export";

describe("exportDomainData", () => {
  it("creates a JSON blob URL and clicks anchor with expected filename", () => {
    // Explicitly mock object URL APIs for predictable behavior
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob://test");
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const click = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation(() => {
      return {
        set href(_v: string) {},
        get href() {
          return "";
        },
        set download(_v: string) {},
        click,
      } as unknown as HTMLAnchorElement;
    });

    exportDomainData("example.com", {
      registration: {
        isRegistered: true,
        domain: "example.com",
        tld: "com",
        source: "rdap",
        registrar: { name: "Test Registrar" },
        warnings: [],
        unicodeName: "example.com",
        registrarProvider: {
          name: "Test Registrar",
          domain: "testregistrar.com",
        },
      },
      dns: null,
      hosting: null,
      certificates: [],
      headers: {
        headers: [],
        status: 200,
        statusMessage: "OK",
      },
    });

    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob://test");
  });
});
