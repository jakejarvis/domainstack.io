import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/mocks/react";

describe("RelativeExpiryString", () => {
  it("renders an invisible placeholder before hydration", async () => {
    vi.resetModules();
    const { resetHydratedNow } = await import("@/hooks/use-hydrated-now");
    const { RelativeExpiryString } = await import("./relative-expiry");

    resetHydratedNow(null);

    render(<RelativeExpiryString to="2026-01-01T00:00:00Z" />);

    expect(screen.getByText("(loading)")).toHaveClass("invisible");
  });

  it("renders the expiry from the shared clock after hydration", async () => {
    vi.resetModules();
    const { resetHydratedNow } = await import("@/hooks/use-hydrated-now");
    const { RelativeExpiryString } = await import("./relative-expiry");

    resetHydratedNow(new Date("2025-01-01T00:00:00Z"));

    render(<RelativeExpiryString to="2026-01-01T00:00:00Z" />);

    expect(await screen.findByText("(in 1 year)")).toBeInTheDocument();
  });
});
