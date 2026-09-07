import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { TtlBadge } from "@/components/domain/dns/ttl-badge";
import { render } from "@/mocks/react";
import { TooltipProvider } from "@domainstack/ui/tooltip";

async function renderTtl(ttl: number) {
  return render(
    <TooltipProvider>
      <TtlBadge ttl={ttl} />
    </TooltipProvider>,
  );
}

describe("TtlBadge", () => {
  it("renders a time element with an ISO 8601 duration", async () => {
    await renderTtl(3600);

    await expect
      .element(page.getByText("1h", { exact: true }))
      .toHaveAttribute("datetime", "PT3600S");
  });

  it("does not render a time element when the TTL is invalid", async () => {
    await renderTtl(Number.NaN);

    expect(document.querySelector("time")).toBeNull();
    await expect.element(page.getByText("-", { exact: true })).toBeInTheDocument();
  });
});
