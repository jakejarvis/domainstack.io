import { describe, expect, it, vi } from "vitest";

import { renderHook } from "@/mocks/react";

describe("useHydratedNow", () => {
  it("keeps a pre-init resetHydratedNow(null) after the initializer microtask", async () => {
    vi.resetModules();
    const { resetHydratedNow, useHydratedNow } = await import("./use-hydrated-now");

    resetHydratedNow(null);
    await Promise.resolve();

    const { result } = renderHook(() => useHydratedNow());
    expect(result.current).toBeNull();
  });
});
