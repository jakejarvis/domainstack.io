import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

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

async function waitForCatalog() {
  await expect.element(page.getByRole("link", { name: "alpha.com" })).toBeInTheDocument();
}

function domainCard(name: string) {
  const card = page.getByRole("link", { name }).element().closest(".group");
  expect(card).not.toBeNull();
  return card as HTMLElement;
}

function cardButton(card: HTMLElement, name: string) {
  const button = Array.from(card.querySelectorAll("button")).find((btn) =>
    btn.textContent?.includes(name),
  );
  expect(button).toBeTruthy();
  return button!;
}

async function selectGridCard(name: string) {
  const card = domainCard(name);
  await userEvent.hover(card);
  await expect.element(page.getByRole("checkbox", { name: `Select ${name}` })).toBeInTheDocument();
  await page.getByRole("checkbox", { name: `Select ${name}` }).click();
}

describe("dashboard confirm dialog", () => {
  beforeEach(async () => {
    resetDashboardTestState();
    await userEvent.unhover(document.body);
  });

  afterEach(() => {
    resetDashboardTestState();
    vi.useRealTimers();
  });

  it("archives a card after confirming the dialog", async () => {
    await renderDashboardConfirmShell();
    await waitForCatalog();

    const card = domainCard("alpha.com");
    await userEvent.hover(card);
    await userEvent.click(cardButton(card, "Actions"));
    await page.getByRole("menuitem", { name: "Archive" }).click();

    await expect.element(page.getByRole("alertdialog")).toBeInTheDocument();
    await expect
      .element(page.getByRole("alertdialog").getByRole("heading", { name: "Archive domain?" }))
      .toBeInTheDocument();
    expect(dashboardActionSpies.onArchive).not.toHaveBeenCalled();

    await page.getByRole("alertdialog").getByRole("button", { name: "Archive" }).click();
    expect(dashboardActionSpies.onArchive).toHaveBeenCalledWith("domain-alpha");
  });

  it("does not archive when the dialog is cancelled", async () => {
    await renderDashboardConfirmShell();
    await waitForCatalog();

    const card = domainCard("alpha.com");
    await userEvent.hover(card);
    await userEvent.click(cardButton(card, "Actions"));
    await page.getByRole("menuitem", { name: "Archive" }).click();

    await expect.element(page.getByRole("alertdialog")).toBeInTheDocument();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();

    await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
    expect(dashboardActionSpies.onArchive).not.toHaveBeenCalled();
  });

  it("bulk-deletes after confirming the dialog", async () => {
    await renderDashboardConfirmShell();
    await waitForCatalog();

    await selectGridCard("alpha.com");
    await selectGridCard("beta.io");

    const toolbar = page.getByRole("toolbar", { name: "Bulk actions" });
    await expect.element(toolbar).toBeInTheDocument();
    await toolbar.getByRole("button", { name: "Delete" }).click();

    await expect.element(page.getByRole("alertdialog")).toBeInTheDocument();
    await expect
      .element(page.getByRole("alertdialog").getByRole("heading", { name: "Delete 2 domains?" }))
      .toBeInTheDocument();
    expect(dashboardActionSpies.onBulkDelete).not.toHaveBeenCalled();

    await page.getByRole("alertdialog").getByRole("button", { name: "Delete All" }).click();
    expect(dashboardActionSpies.onBulkDelete).toHaveBeenCalledWith(["domain-alpha", "domain-beta"]);
  });
});
