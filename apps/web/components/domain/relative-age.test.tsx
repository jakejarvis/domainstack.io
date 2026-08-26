import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/mocks/react";

describe("RelativeAgeString", () => {
  it("renders an invisible placeholder before hydration", async () => {
    vi.resetModules();
    const { resetHydratedNow } = await import("@/hooks/use-hydrated-now");
    const { RelativeAgeString } = await import("./relative-age");

    // Match the server and first client render: no clock yet.
    resetHydratedNow(null);

    render(<RelativeAgeString from="2020-01-01T00:00:00Z" />);

    expect(screen.getByText("(loading)")).toHaveClass("invisible");
  });

  it("renders the age from the shared clock after hydration", async () => {
    vi.resetModules();
    const { resetHydratedNow } = await import("@/hooks/use-hydrated-now");
    const { RelativeAgeString } = await import("./relative-age");

    resetHydratedNow(new Date("2025-01-01T00:00:00Z"));

    render(<RelativeAgeString from="2020-01-01T00:00:00Z" />);

    expect(await screen.findByText("(5 years ago)")).toBeInTheDocument();
  });
});
