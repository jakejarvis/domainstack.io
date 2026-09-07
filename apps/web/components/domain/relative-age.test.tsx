import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";

describe("RelativeAgeString", () => {
  it("renders an invisible time placeholder before hydration", async () => {
    vi.resetModules();
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    const { resetHydratedNow } = await import("@/hooks/use-hydrated-now");
    const { RelativeAgeString } = await import("./relative-age");

    // Match the server and first client render: no clock yet.
    resetHydratedNow(null);

    await render(<RelativeAgeString from="2020-01-01T00:00:00Z" />);

    await expect.element(page.getByText("()", { exact: true })).toHaveClass("invisible");
    expect(document.querySelector("time")).toHaveAttribute("datetime", "2020-01-01T00:00:00.000Z");
    raf.mockRestore();
  });

  it("renders the age from the shared clock after hydration", async () => {
    vi.resetModules();
    const { resetHydratedNow } = await import("@/hooks/use-hydrated-now");
    const { RelativeAgeString } = await import("./relative-age");

    resetHydratedNow(new Date("2025-01-01T00:00:00Z"));

    await render(<RelativeAgeString from="2020-01-01T00:00:00Z" />);

    await expect.element(page.getByText("(5 years ago)", { exact: true })).toBeInTheDocument();
    await expect
      .element(page.getByText("5 years ago", { exact: true }))
      .toHaveAttribute("datetime", "2020-01-01T00:00:00.000Z");
  });

  it("renders nothing when the date is invalid", async () => {
    vi.resetModules();
    const { resetHydratedNow } = await import("@/hooks/use-hydrated-now");
    const { RelativeAgeString } = await import("./relative-age");

    resetHydratedNow(new Date("2025-01-01T00:00:00Z"));

    await render(<RelativeAgeString from="Unknown" />);

    expect(document.querySelector("time")).toBeNull();
    await expect.element(page.getByText("()", { exact: true })).not.toBeInTheDocument();
  });
});
