import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { PlanUsage } from "@/components/plan-usage";
import { render } from "@/mocks/react";

describe("PlanUsage", () => {
  it("shows the tracked count against the plan quota", async () => {
    await render(<PlanUsage activeCount={3} planQuota={5} archivedCount={0} />);

    await expect.element(page.getByText("Tracked domains")).toBeInTheDocument();
    await expect.element(page.getByText("/ 5")).toBeInTheDocument();
    await expect.element(page.getByText("3", { exact: true })).toBeInTheDocument();
  });

  it("hides the archived note when nothing is archived", async () => {
    await render(<PlanUsage activeCount={3} planQuota={5} archivedCount={0} />);

    await expect.element(page.getByText(/archived/)).not.toBeInTheDocument();
  });

  it("uses singular wording for one archived domain", async () => {
    await render(<PlanUsage activeCount={3} planQuota={5} archivedCount={1} />);

    await expect
      .element(page.getByText(/archived domain doesn't count toward this limit/))
      .toBeInTheDocument();
  });

  it("uses plural wording for several archived domains", async () => {
    await render(<PlanUsage activeCount={5} planQuota={5} archivedCount={4} />);

    await expect
      .element(page.getByText(/archived domains don't count toward this limit/))
      .toBeInTheDocument();
  });
});
