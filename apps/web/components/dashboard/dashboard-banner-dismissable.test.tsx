import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DashboardBannerDismissable } from "@/components/dashboard/dashboard-banner-dismissable";
import { render, screen, waitFor } from "@/mocks/react";

describe("DashboardBannerDismissable", () => {
  it("forwards onDismiss when the banner is dismissed", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn<() => void>();

    render(
      <DashboardBannerDismissable
        variant="success"
        title="Welcome to Pro!"
        description="Thanks for upgrading."
        dismissible
        onDismiss={onDismiss}
      />,
    );

    const banner = screen.getByText("Welcome to Pro!").closest("[data-slot=card]");
    expect(banner).toBeTruthy();
    await user.hover(banner!);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(screen.queryByText("Welcome to Pro!")).not.toBeInTheDocument();
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
