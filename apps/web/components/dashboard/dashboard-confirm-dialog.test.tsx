import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-subscription", async () => {
  const { useSubscription } = await import("./mocks/subscription");
  return { useSubscription };
});
vi.mock("@/components/icons/favicon", async () => {
  const { Favicon } = await import("./mocks/leaf");
  return { Favicon };
});
vi.mock("@/components/icons/provider-logo", async () => {
  const { ProviderLogo } = await import("./mocks/leaf");
  return { ProviderLogo };
});
vi.mock("@/components/domain/screenshot-popover", async () => {
  const { ScreenshotPopover } = await import("./mocks/leaf");
  return { ScreenshotPopover };
});
vi.mock("@/components/dashboard/calendar-feed-popover", async () => {
  const { CalendarFeedPopover } = await import("./mocks/leaf");
  return { CalendarFeedPopover };
});
vi.mock("@/hooks/use-provider-tooltip-data", async () => {
  const { useProviderTooltipData } = await import("./mocks/leaf");
  return { useProviderTooltipData };
});

import {
  dashboardActionSpies,
  renderDashboardConfirmShell,
  resetDashboardTestState,
} from "@/components/dashboard/test-utils";
import { screen, waitFor, within } from "@/mocks/react";

async function waitForCatalog() {
  await waitFor(() => {
    expect(screen.getByRole("link", { name: "alpha.com" })).toBeInTheDocument();
  });
}

function domainCard(name: string) {
  const card = screen.getByRole("link", { name }).closest(".group");
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

async function selectGridCard(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.hover(domainCard(name));
  await user.click(screen.getByRole("checkbox", { name: `Select ${name}` }));
}

describe("dashboard confirm dialog", () => {
  beforeEach(() => {
    resetDashboardTestState();
  });

  afterEach(() => {
    resetDashboardTestState();
    vi.useRealTimers();
  });

  it("archives a card after confirming the dialog", async () => {
    const user = userEvent.setup();
    renderDashboardConfirmShell();
    await waitForCatalog();

    const card = domainCard("alpha.com");
    await user.hover(card);
    await user.click(within(card).getByRole("button", { name: "Actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Archive" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("heading", { name: "Archive domain?" })).toBeInTheDocument();
    expect(dashboardActionSpies.onArchive).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Archive" }));
    expect(dashboardActionSpies.onArchive).toHaveBeenCalledWith("domain-alpha");
  });

  it("does not archive when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    renderDashboardConfirmShell();
    await waitForCatalog();

    const card = domainCard("alpha.com");
    await user.hover(card);
    await user.click(within(card).getByRole("button", { name: "Actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Archive" }));

    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(dashboardActionSpies.onArchive).not.toHaveBeenCalled();
  });

  it("bulk-deletes after confirming the dialog", async () => {
    const user = userEvent.setup();
    renderDashboardConfirmShell();
    await waitForCatalog();

    await selectGridCard(user, "alpha.com");
    await selectGridCard(user, "beta.io");

    const toolbar = await screen.findByRole("toolbar", { name: "Bulk actions" });
    await user.click(within(toolbar).getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("heading", { name: "Delete 2 domains?" })).toBeInTheDocument();
    expect(dashboardActionSpies.onBulkDelete).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Delete All" }));
    expect(dashboardActionSpies.onBulkDelete).toHaveBeenCalledWith(["domain-alpha", "domain-beta"]);
  });
});
