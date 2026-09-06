import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";

describe("RelativeExpiryString", () => {
  it("renders an invisible placeholder before hydration", async () => {
    vi.resetModules();
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    const { resetHydratedNow } = await import("@/hooks/use-hydrated-now");
    const { RelativeExpiryString } = await import("./relative-expiry");

    resetHydratedNow(null);

    await render(<RelativeExpiryString to="2026-01-01T00:00:00Z" />);

    await expect.element(page.getByText("(loading)", { exact: true })).toHaveClass("invisible");
    raf.mockRestore();
  });

  it("renders the expiry from the shared clock after hydration", async () => {
    vi.resetModules();
    const { resetHydratedNow } = await import("@/hooks/use-hydrated-now");
    const { RelativeExpiryString } = await import("./relative-expiry");

    resetHydratedNow(new Date("2025-01-01T00:00:00Z"));

    await render(<RelativeExpiryString to="2026-01-01T00:00:00Z" />);

    await expect.element(page.getByText("(in 1 year)", { exact: true })).toBeInTheDocument();
  });
});
