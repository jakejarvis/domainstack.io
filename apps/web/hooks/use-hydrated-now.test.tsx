import { describe, expect, it, vi } from "vitest";

import { renderHook } from "@/mocks/react";

describe("useHydratedNow", () => {
  it("stays null on the first render after resetHydratedNow(null)", async () => {
    vi.resetModules();
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    const { resetHydratedNow, useHydratedNow } = await import("./use-hydrated-now");

    resetHydratedNow(null);

    const { result } = await renderHook(() => useHydratedNow());
    expect(result.current).toBeNull();
    raf.mockRestore();
  });

  it("refreshes the clock when a consumer mounts after everything unsubscribed", async () => {
    vi.resetModules();
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    try {
      const t0 = new Date("2026-01-01T00:00:00.000Z");
      vi.setSystemTime(t0);
      const { resetHydratedNow, useHydratedNow } = await import("./use-hydrated-now");
      // Clear state left by earlier tests. `null` leaves the clock unpinned; a
      // Date would pin it and hide the restart behavior under test.
      resetHydratedNow(null);

      const first = await renderHook(() => useHydratedNow());
      await vi.waitFor(() => expect(first.result.current?.getTime()).toBe(t0.getTime()));
      await first.unmount();

      const later = new Date(t0.getTime() + 2 * 60 * 60 * 1000);
      vi.setSystemTime(later);

      const second = await renderHook(() => useHydratedNow());
      await vi.waitFor(() => expect(second.result.current?.getTime()).toBe(later.getTime()));
      await second.unmount();
    } finally {
      vi.useRealTimers();
      raf.mockRestore();
    }
  });
});
