/**
 * @vitest-environment jsdom
 */

"use client";

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLogger } from "./use-logger";

describe("useLogger", () => {
  it("returns a logger instance with all methods", () => {
    const { result } = renderHook(() => useLogger());

    expect(result.current).toBeDefined();
    expect(typeof result.current.trace).toBe("function");
    expect(typeof result.current.debug).toBe("function");
    expect(typeof result.current.info).toBe("function");
    expect(typeof result.current.warn).toBe("function");
    expect(typeof result.current.error).toBe("function");
    expect(typeof result.current.fatal).toBe("function");
  });

  it("returns a logger with base context", () => {
    const { result } = renderHook(() =>
      useLogger({ component: "TestComponent" }),
    );
    expect(result.current).toBeDefined();
  });
});
