import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";

describe("RelativeAgeString", () => {
  it("renders an invisible placeholder before hydration", async () => {
    vi.resetModules();
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    const { resetHydratedNow } = await import("@/hooks/use-hydrated-now");
    const { RelativeAgeString } = await import("./relative-age");

    // Match the server and first client render: no clock yet.
    resetHydratedNow(null);

    await render(<RelativeAgeString from="2020-01-01T00:00:00Z" />);

    await expect.element(page.getByText("(loading)", { exact: true })).toHaveClass("invisible");
    raf.mockRestore();
  });

  it("renders the age from the shared clock after hydration", async () => {
    vi.resetModules();
    const { resetHydratedNow } = await import("@/hooks/use-hydrated-now");
    const { RelativeAgeString } = await import("./relative-age");

    resetHydratedNow(new Date("2025-01-01T00:00:00Z"));

    await render(<RelativeAgeString from="2020-01-01T00:00:00Z" />);

    await expect.element(page.getByText("(5 years ago)", { exact: true })).toBeInTheDocument();
  });
});
