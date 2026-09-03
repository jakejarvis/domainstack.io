import { describe, expect, it, vi } from "vitest";

import { renderHook } from "@/mocks/react";

describe("useHydratedNow", () => {
  it("stays null on the first render after resetHydratedNow(null)", async () => {
    vi.resetModules();
    const { resetHydratedNow, useHydratedNow } = await import("./use-hydrated-now");

    resetHydratedNow(null);

    const { result } = renderHook(() => useHydratedNow());
    expect(result.current).toBeNull();
  });
});
