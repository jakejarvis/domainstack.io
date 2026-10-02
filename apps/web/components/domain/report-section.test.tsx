import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import { render } from "@/mocks/react";

import { ReportSection } from "./report-section";

describe("ReportSection help", () => {
  it("is a real button that keyboard users can reach and that reveals the help text", async () => {
    await render(
      <ReportSection title="DNS" help="Records that point your domain at servers.">
        <p>content</p>
      </ReportSection>,
    );

    const trigger = page.getByRole("button", { name: "More info about DNS" });
    await expect.element(trigger).toBeVisible();
    await expect
      .element(page.getByText("Records that point your domain at servers."))
      .not.toBeInTheDocument();

    await userEvent.tab();

    await expect.element(trigger).toHaveFocus();
    await expect
      .element(page.getByText("Records that point your domain at servers."))
      .toBeVisible();
  });

  it("renders no help control when there is no help text", async () => {
    await render(
      <ReportSection title="DNS">
        <p>content</p>
      </ReportSection>,
    );

    await expect
      .element(page.getByRole("button", { name: /More info about/ }))
      .not.toBeInTheDocument();
  });
});
