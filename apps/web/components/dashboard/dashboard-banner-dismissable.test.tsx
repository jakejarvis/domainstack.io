import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { DashboardBannerDismissable } from "@/components/dashboard/dashboard-banner-dismissable";
import { render } from "@/mocks/react";

describe("DashboardBannerDismissable", () => {
  it("forwards onDismiss when the banner is dismissed", async () => {
    const onDismiss = vi.fn<() => void>();

    await render(
      <DashboardBannerDismissable
        variant="success"
        title="Welcome to Pro!"
        description="Thanks for upgrading."
        dismissible
        onDismiss={onDismiss}
      />,
    );

    await expect.element(page.getByText("Welcome to Pro!", { exact: true })).toBeVisible();

    const banner = page
      .getByText("Welcome to Pro!", { exact: true })
      .element()
      .closest("[data-slot=card]");
    expect(banner).toBeTruthy();
    await userEvent.hover(banner!);
    await page.getByRole("button", { name: "Dismiss" }).click();

    await expect
      .element(page.getByText("Welcome to Pro!", { exact: true }))
      .not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
