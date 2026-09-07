import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { render } from "@/mocks/react";
import { TooltipProvider } from "@domainstack/ui/tooltip";

describe("DomainHealthBadge", () => {
  it("shows unknown when expirationDate is not a valid date", async () => {
    vi.resetModules();
    const { resetHydratedNow } = await import("@/hooks/use-hydrated-now");
    const { DomainHealthBadge, getHealthAccent } = await import("./domain-health-badge");

    const now = new Date("2025-01-01T00:00:00Z");
    resetHydratedNow(now);

    await render(
      <TooltipProvider>
        <DomainHealthBadge expirationDate={new Date(Number.NaN)} verified />
      </TooltipProvider>,
    );

    await expect.element(page.getByText("Unknown", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText("Healthy", { exact: true })).not.toBeInTheDocument();
    expect(getHealthAccent(new Date(Number.NaN), true, now)).toBe("slate");
  });

  it("shows healthy for a far-future expiration", async () => {
    vi.resetModules();
    const { resetHydratedNow } = await import("@/hooks/use-hydrated-now");
    const { DomainHealthBadge } = await import("./domain-health-badge");

    resetHydratedNow(new Date("2025-01-01T00:00:00Z"));

    await render(
      <TooltipProvider>
        <DomainHealthBadge expirationDate={new Date("2026-01-01T00:00:00Z")} verified />
      </TooltipProvider>,
    );

    await expect.element(page.getByText("Healthy", { exact: true })).toBeInTheDocument();
  });
});
