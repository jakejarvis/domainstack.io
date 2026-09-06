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

import { makePaginationDomains, makeTrackedDomain } from "@/components/dashboard/test-fixtures";
import {
  dashboardActionSpies,
  renderDashboardShell,
  resetDashboardTestState,
} from "@/components/dashboard/test-utils";
import { usePreferencesStore } from "@/lib/stores/preferences-store";

function domainNames() {
  return page
    .getByRole("link")
    .elements()
    .map((el) => el.textContent?.replace(/\s+/g, " ").trim() ?? "")
    .filter((name) => name.includes("."));
}

function getFilterTrigger(name: RegExp) {
  return page.getByRole("combobox", { name }).nth(0);
}

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

describe("dashboard shell", () => {
  beforeEach(async () => {
    resetDashboardTestState();
    await userEvent.unhover(document.body);
  });

  afterEach(() => {
    resetDashboardTestState();
    vi.useRealTimers();
  });

  describe("view toggle and empty states", () => {
    it("renders the grid by default without a table", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await expect.element(page.getByRole("heading", { name: /Welcome back/ })).toBeInTheDocument();
      await expect.element(page.getByRole("button", { name: "Grid view" })).toBeInTheDocument();
      await expect.element(page.getByRole("table")).not.toBeInTheDocument();
      expect(domainNames()).toEqual(
        expect.arrayContaining(["alpha.com", "beta.io", "gamma.com", "pending.dev"]),
      );
    });

    it("switches between grid and table", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await page.getByRole("button", { name: "Table view" }).click();
      await expect.element(page.getByRole("table")).toBeInTheDocument();
      await expect.element(page.getByRole("link", { name: "alpha.com" })).toBeInTheDocument();

      await page.getByRole("button", { name: "Grid view" }).click();
      await expect.element(page.getByRole("table")).not.toBeInTheDocument();
      await expect.element(page.getByRole("link", { name: "alpha.com" })).toBeInTheDocument();
    });

    it("shows the first-time empty state", async () => {
      await renderDashboardShell({ domains: [], totalDomains: 0 });

      await expect
        .element(page.getByText("Start tracking your domains", { exact: true }))
        .toBeInTheDocument();
      await expect
        .element(page.getByRole("link", { name: /Add Your First Domain/ }))
        .toBeInTheDocument();
      await expect.element(page.getByRole("button", { name: "Grid view" })).not.toBeInTheDocument();
    });

    it("shows a no-matches empty state and restores cards after clearing filters", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await page.getByRole("textbox", { name: "Search domains" }).fill("zzzz");
      await expect
        .element(page.getByText("No domains match your filters", { exact: true }))
        .toBeInTheDocument();

      await page.getByRole("button", { name: "Clear Filters" }).click();
      await expect.element(page.getByRole("link", { name: "alpha.com" })).toBeInTheDocument();
    });
  });

  describe("grid", () => {
    it("shows status badges and complete-verification on unverified cards", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      expect(page.getByText("Verified", { exact: true }).length).toBeGreaterThan(0);
      await expect.element(page.getByText("Pending", { exact: true })).toBeInTheDocument();
      await expect.element(page.getByText("Healthy", { exact: true })).toBeInTheDocument();
      expect(page.getByText("Needs Attention", { exact: true }).length).toBeGreaterThan(0);

      await page.getByRole("button", { name: /Complete Verification/ }).click();
      expect(dashboardActionSpies.onVerify).toHaveBeenCalledWith("domain-pending", null);
    });

    it("archives, mutes, and removes a verified card from the actions menu", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      const alphaCard = domainCard("alpha.com");
      await userEvent.click(cardButton(alphaCard, "Actions"));
      await expect.element(page.getByRole("menuitem", { name: "Archive" })).toBeInTheDocument();
      await page.getByRole("menuitem", { name: "Archive" }).click();
      expect(dashboardActionSpies.onArchive).toHaveBeenCalledWith("domain-alpha");

      await userEvent.click(cardButton(alphaCard, "Actions"));
      await expect.element(page.getByRole("menuitem", { name: "Mute" })).toBeInTheDocument();
      await page.getByRole("menuitem", { name: "Mute" }).click();
      expect(dashboardActionSpies.onMute).toHaveBeenCalledWith("domain-alpha", true);

      await userEvent.click(cardButton(alphaCard, "Actions"));
      await expect.element(page.getByRole("menuitem", { name: "Remove" })).toBeInTheDocument();
      await page.getByRole("menuitem", { name: "Remove" }).click();
      expect(dashboardActionSpies.onRemove).toHaveBeenCalledWith("domain-alpha");
    });

    it("reorders cards from the sort dropdown", async () => {
      const { urlUpdates } = await renderDashboardShell();
      await waitForCatalog();

      await page.getByRole("button", { name: /Sort:/ }).click();
      await expect
        .element(page.getByRole("menuitemradio", { name: "Name (Z-A)" }))
        .toBeInTheDocument();
      await page.getByRole("menuitemradio", { name: "Name (Z-A)" }).click();

      await vi.waitFor(() => {
        expect(domainNames()).toEqual(["pending.dev", "gamma.com", "beta.io", "alpha.com"]);
      });
      expect(urlUpdates.some((url) => url.includes("sort=domainName.desc"))).toBe(true);
    });

    it("sorts by expiry from the dropdown and keeps unverified last", async () => {
      const { urlUpdates } = await renderDashboardShell();
      await waitForCatalog();

      await page.getByRole("button", { name: /Sort:/ }).click();
      await expect
        .element(page.getByRole("menuitemradio", { name: "Expiry (Soonest first)" }))
        .toBeInTheDocument();
      await page.getByRole("menuitemradio", { name: "Expiry (Soonest first)" }).click();

      await vi.waitFor(() => {
        expect(domainNames()).toEqual(["gamma.com", "beta.io", "alpha.com", "pending.dev"]);
      });
      expect(urlUpdates.some((url) => url.includes("sort=expirationDate.asc"))).toBe(true);
    });

    it("selects a card and shows the bulk toolbar", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await expect
        .element(page.getByRole("toolbar", { name: "Bulk actions" }))
        .not.toBeInTheDocument();

      await selectGridCard("alpha.com");

      const toolbar = page.getByRole("toolbar", { name: "Bulk actions" });
      await expect.element(toolbar).toBeInTheDocument();
      await expect.element(toolbar.getByText("1 selected", { exact: true })).toBeInTheDocument();
    });
  });

  describe("table", () => {
    async function openTable() {
      await page.getByRole("button", { name: "Table view" }).click();
      await expect.element(page.getByRole("table")).toBeInTheDocument();
    }

    it("renders domain links and unverified continue/remove actions", async () => {
      await renderDashboardShell();
      await waitForCatalog();
      await openTable();

      const table = page.getByRole("table");
      await expect.element(table.getByRole("link", { name: "alpha.com" })).toBeInTheDocument();

      await table.getByRole("button", { name: "Continue" }).click();
      expect(dashboardActionSpies.onVerify).toHaveBeenCalledWith("domain-pending", null);

      await table.getByRole("button", { name: "Remove" }).click();
      expect(dashboardActionSpies.onRemove).toHaveBeenCalledWith("domain-pending");
    });

    it("toggles sort from the domain header and keeps unverified last on expiry", async () => {
      const { urlUpdates } = await renderDashboardShell();
      await waitForCatalog();
      await openTable();

      await page.getByRole("button", { name: /^Domain$/ }).click();
      await vi.waitFor(() => {
        expect(urlUpdates.some((url) => url.includes("sort=domainName.desc"))).toBe(true);
      });

      await page.getByRole("button", { name: /^Expires$/ }).click();
      await vi.waitFor(() => {
        const names = page
          .getByRole("table")
          .getByRole("link")
          .elements()
          .map((el) => el.textContent?.trim());
        expect(names.at(-1)).toBe("pending.dev");
      });
    });

    it("sorts the domain column case-insensitively", async () => {
      await renderDashboardShell({
        domains: [
          makeTrackedDomain({ id: "domain-zeta", domainName: "Zeta.com" }),
          makeTrackedDomain({ id: "domain-alpha", domainName: "alpha.com" }),
          makeTrackedDomain({ id: "domain-beta", domainName: "Beta.io" }),
        ],
      });
      await waitForCatalog();
      await openTable();

      // The domain column has no explicit `sortFn`, so it resolves `"auto"` ->
      // `text` from the registry on `dashboardTableFeatures`. Without that
      // registration it silently falls back to `basic`, which sorts by code
      // point and puts every capitalized domain ahead of the lowercase ones.
      await vi.waitFor(() => {
        const names = page
          .getByRole("table")
          .getByRole("link")
          .elements()
          .map((el) => el.textContent?.trim());
        expect(names).toEqual(["alpha.com", "Beta.io", "Zeta.com"]);
      });
    });

    it("paginates and resets the page when page size changes", async () => {
      const { urlUpdates } = await renderDashboardShell({ domains: makePaginationDomains(12) });
      await expect.element(page.getByRole("link", { name: "site00.com" })).toBeInTheDocument();
      await openTable();

      const table = page.getByRole("table");
      expect(table.getByRole("link").length).toBe(10);
      await expect.element(page.getByText("1 of 2", { exact: true })).toBeInTheDocument();

      await page.getByRole("button", { name: "Go to next page" }).click();
      await expect.element(page.getByText("2 of 2", { exact: true })).toBeInTheDocument();
      await expect
        .element(page.getByRole("table").getByRole("link", { name: "site00.com" }))
        .not.toBeInTheDocument();
      expect(page.getByRole("table").getByRole("link").length).toBe(2);
      expect(urlUpdates.some((url) => /(?:^|[?&])page=2(?:&|$)/.test(url))).toBe(true);

      const pageSize = page.getByRole("combobox", { name: "Domains per page" });
      await pageSize.click();
      await expect.element(page.getByRole("option", { name: "25" })).toBeInTheDocument();
      await page.getByRole("option", { name: "25" }).click();
      await vi.waitFor(() => {
        expect(page.getByRole("table").getByRole("link").length).toBe(12);
      });
      await expect.element(page.getByText("1 of 1", { exact: true })).toBeInTheDocument();
    });

    it("returns to page 1 when filters change even if page 2 still has rows", async () => {
      usePreferencesStore.setState({ viewMode: "table" });
      await renderDashboardShell({
        domains: makePaginationDomains(12),
        searchParams: "page=2",
      });

      await expect.element(page.getByText("2 of 2", { exact: true })).toBeInTheDocument();
      await expect
        .element(page.getByRole("table").getByRole("link", { name: "site00.com" }))
        .not.toBeInTheDocument();

      await page.getByRole("button", { name: "Grid view" }).click();
      // "s" still matches all 12 sites, so clamp alone would leave page 2 empty of site00.
      await userEvent.type(
        page.getByRole("textbox", { name: "Search domains" }).first().element(),
        "s",
      );
      await vi.waitFor(() => {
        expect(domainNames()).toEqual(expect.arrayContaining(["site00.com", "site11.com"]));
      });

      await page.getByRole("button", { name: "Table view" }).click();
      await expect
        .element(page.getByRole("table").getByRole("link", { name: "site00.com" }))
        .toBeInTheDocument();
      await expect.element(page.getByText("1 of 2", { exact: true })).toBeInTheDocument();
    });

    it("clamps an impossible deep-linked page to page 1", async () => {
      usePreferencesStore.setState({ viewMode: "table" });
      await renderDashboardShell({
        domains: makePaginationDomains(2),
        searchParams: "page=2",
      });

      await expect.element(page.getByRole("table")).toBeInTheDocument();
      await expect
        .element(page.getByRole("table").getByRole("link", { name: "site00.com" }))
        .toBeInTheDocument();
      await expect.element(page.getByText("1 of 1", { exact: true })).toBeInTheDocument();
    });

    it("keeps a deep-linked page when filters are not changed", async () => {
      usePreferencesStore.setState({ viewMode: "table" });
      await renderDashboardShell({
        domains: makePaginationDomains(12),
        searchParams: "page=2",
      });

      await expect.element(page.getByRole("table")).toBeInTheDocument();
      await expect.element(page.getByText("2 of 2", { exact: true })).toBeInTheDocument();
      await expect
        .element(page.getByRole("table").getByRole("link", { name: "site00.com" }))
        .not.toBeInTheDocument();
      expect(page.getByRole("table").getByRole("link").length).toBe(2);

      await page.getByRole("button", { name: "Go to previous page" }).click();
      await expect
        .element(page.getByRole("table").getByRole("link", { name: "site00.com" }))
        .toBeInTheDocument();
    });

    it("hides and restores a column from the column menu", async () => {
      await renderDashboardShell();
      await waitForCatalog();
      await openTable();

      await expect.element(page.getByRole("button", { name: /^Registrar$/ })).toBeInTheDocument();

      await page.getByRole("button", { name: "Toggle columns" }).first().click();
      await expect
        .element(page.getByRole("menuitemcheckbox", { name: /Registrar/ }))
        .toBeInTheDocument();
      await page.getByRole("menuitemcheckbox", { name: /Registrar/ }).click();

      await expect
        .element(page.getByRole("button", { name: /^Registrar$/ }))
        .not.toBeInTheDocument();

      await expect
        .element(page.getByRole("menuitem", { name: /Show all columns/ }))
        .toBeInTheDocument();
      await page.getByRole("menuitem", { name: /Show all columns/ }).click();
      await expect.element(page.getByRole("button", { name: /^Registrar$/ })).toBeInTheDocument();
    });

    it("selects a row and shows the bulk toolbar", async () => {
      await renderDashboardShell();
      await waitForCatalog();
      await openTable();

      await page.getByRole("checkbox", { name: "Select alpha.com" }).click();
      await expect.element(page.getByRole("toolbar", { name: "Bulk actions" })).toBeInTheDocument();
    });
  });

  describe("filters", () => {
    it("filters by search and restores after clearing the chip", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await page.getByRole("textbox", { name: "Search domains" }).fill("beta");
      await vi.waitFor(() => {
        expect(domainNames()).toEqual(["beta.io"]);
      });
      await expect.element(page.getByText('"beta"', { exact: true })).toBeInTheDocument();

      await page.getByRole("button", { name: "Remove search filter" }).click();
      await vi.waitFor(() => {
        expect(domainNames()).toEqual(expect.arrayContaining(["alpha.com", "beta.io"]));
      });
    });

    it("filters by health from the dropdown and supports clear all", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await getFilterTrigger(/^Health/).click();
      await expect.element(page.getByRole("option", { name: "Expiring Soon" })).toBeInTheDocument();
      await page.getByRole("option", { name: "Expiring Soon" }).click();

      await vi.waitFor(() => {
        expect(domainNames()).toEqual(["beta.io"]);
      });
      await expect
        .element(page.getByRole("button", { name: "Remove health filter" }))
        .toBeInTheDocument();

      await page.getByRole("button", { name: "Clear all" }).click();
      await vi.waitFor(() => {
        expect(domainNames()).toEqual(expect.arrayContaining(["alpha.com", "gamma.com"]));
      });
    });

    it("filters by TLD and provider from initial search params", async () => {
      await renderDashboardShell({ searchParams: "tlds=io" });
      await vi.waitFor(() => {
        expect(domainNames()).toEqual(["beta.io"]);
      });
      await expect.element(page.getByText(".io", { exact: true })).toBeInTheDocument();
    });

    it("filters by provider from initial search params", async () => {
      await renderDashboardShell({ searchParams: "providers=cloudflare" });
      await vi.waitFor(() => {
        expect(domainNames().sort()).toEqual(["alpha.com", "beta.io"]);
      });
    });

    it("applies pending and expiring filters from the health summary", async () => {
      await renderDashboardShell();
      await expect
        .element(page.getByRole("button", { name: "Filter by pending verification" }))
        .toBeInTheDocument();
      await expect
        .element(page.getByRole("button", { name: "Filter by expiring domains" }))
        .toHaveTextContent("1expiring soon");

      await page.getByRole("button", { name: "Filter by pending verification" }).click();
      await vi.waitFor(() => {
        expect(domainNames()).toEqual(["pending.dev"]);
      });
      await expect
        .element(page.getByRole("button", { name: "Remove status filter" }))
        .toBeInTheDocument();

      await page.getByRole("button", { name: "Clear all" }).click();
      await page.getByRole("button", { name: "Filter by expiring domains" }).click();
      await vi.waitFor(() => {
        expect(domainNames()).toEqual(["beta.io"]);
      });
    });

    it("removes one chip without clearing the rest", async () => {
      await renderDashboardShell({ searchParams: "search=a&tlds=com" });
      await vi.waitFor(() => {
        expect(domainNames().sort()).toEqual(["alpha.com", "gamma.com"]);
      });

      await page.getByRole("button", { name: "Remove tld filter" }).click();
      await vi.waitFor(() => {
        expect(domainNames()).toEqual(expect.arrayContaining(["alpha.com", "beta.io"]));
      });
      await expect.element(page.getByText('"a"', { exact: true })).toBeInTheDocument();
    });

    it("pins a domain from domainId search params", async () => {
      await renderDashboardShell({ searchParams: "domainId=domain-alpha" });
      await vi.waitFor(() => {
        expect(domainNames()).toEqual(["alpha.com"]);
      });
      await expect.element(page.getByRole("link", { name: "alpha.com" })).toBeInTheDocument();
      await expect.element(page.getByText("Domain:", { exact: true })).toBeInTheDocument();
    });
  });

  describe("bulk toolbar", () => {
    it("archives, deletes, mutes, unmutes, cancels, and select-alls visible ids", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await selectGridCard("alpha.com");
      await selectGridCard("beta.io");

      const toolbar = page.getByRole("toolbar", { name: "Bulk actions" });
      await expect.element(toolbar).toBeInTheDocument();
      await expect.element(toolbar.getByText("2 selected", { exact: true })).toBeInTheDocument();

      await toolbar.getByRole("button", { name: "Mute" }).click();
      expect(dashboardActionSpies.onBulkMute).toHaveBeenCalledWith(
        ["domain-alpha", "domain-beta"],
        true,
      );

      await toolbar.getByRole("button", { name: "Unmute" }).click();
      expect(dashboardActionSpies.onBulkMute).toHaveBeenCalledWith(
        ["domain-alpha", "domain-beta"],
        false,
      );

      await toolbar.getByRole("button", { name: "Archive" }).click();
      expect(dashboardActionSpies.onBulkArchive).toHaveBeenCalledWith([
        "domain-alpha",
        "domain-beta",
      ]);

      await toolbar.getByRole("button", { name: "Delete" }).click();
      expect(dashboardActionSpies.onBulkDelete).toHaveBeenCalledWith([
        "domain-alpha",
        "domain-beta",
      ]);

      await toolbar.getByRole("button", { name: "Cancel selection" }).click();
      await expect
        .element(page.getByRole("toolbar", { name: "Bulk actions" }))
        .not.toBeInTheDocument();

      await selectGridCard("alpha.com");
      const toolbarAgain = page.getByRole("toolbar", { name: "Bulk actions" });
      await expect.element(toolbarAgain).toBeInTheDocument();
      await toolbarAgain.getByRole("checkbox").click();
      await expect
        .element(toolbarAgain.getByText("4 selected", { exact: true }))
        .toBeInTheDocument();
    });

    it("selects only the filtered visible ids", async () => {
      await renderDashboardShell({ searchParams: "tlds=com" });
      await vi.waitFor(() => {
        expect(domainNames().sort()).toEqual(["alpha.com", "gamma.com"]);
      });

      await selectGridCard("alpha.com");
      const toolbar = page.getByRole("toolbar", { name: "Bulk actions" });
      await expect.element(toolbar).toBeInTheDocument();
      await toolbar.getByRole("checkbox").click();
      await expect.element(toolbar.getByText("2 selected", { exact: true })).toBeInTheDocument();
    });

    it("drops hidden domains from the selection when filters change", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await selectGridCard("alpha.com");
      await expect.element(page.getByRole("toolbar", { name: "Bulk actions" })).toBeInTheDocument();

      await page.getByRole("textbox", { name: "Search domains" }).fill("beta");
      await vi.waitFor(() => {
        expect(domainNames()).toEqual(["beta.io"]);
      });
      await expect
        .element(page.getByRole("toolbar", { name: "Bulk actions" }))
        .not.toBeInTheDocument();
    });

    it("clears selection on Escape", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await selectGridCard("alpha.com");
      await expect.element(page.getByRole("toolbar", { name: "Bulk actions" })).toBeInTheDocument();

      await userEvent.keyboard("{Escape}");
      await expect
        .element(page.getByRole("toolbar", { name: "Bulk actions" }))
        .not.toBeInTheDocument();
    });
  });

  describe("preferences", () => {
    it("opens in table view when the preference is already table", async () => {
      usePreferencesStore.setState({ viewMode: "table" });
      await renderDashboardShell();
      await expect.element(page.getByRole("table")).toBeInTheDocument();
      // Stay mounted long enough that a table-wrapper setState loop would throw.
      await expect.element(page.getByRole("link", { name: "alpha.com" })).toBeInTheDocument();
    });
  });
});
