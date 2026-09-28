import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

vi.mock("@/hooks/use-subscription", async () => {
  const { useSubscription } = await import("./mocks/subscription");
  return { useSubscription };
});
vi.mock("@/hooks/use-router", async () => {
  const { useRouter } = await import("./mocks/router");
  return { useRouter };
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

import { HIDEABLE_COLUMNS } from "@/components/dashboard/dashboard-table-columns";
import {
  makeDashboardDomains,
  makePaginationDomains,
  makeTrackedDomain,
} from "@/components/dashboard/test-fixtures";
import {
  dashboardActionSpies,
  mockSubscription,
  renderDashboardConfirmShell,
  renderDashboardShell,
  resetDashboardTestState,
  routerSpies,
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

async function pressSelectAllHotkey() {
  const modifier = navigator.platform.includes("Mac") ? "Meta" : "Control";
  await userEvent.keyboard(`{${modifier}>}a{/${modifier}}`);
}

async function clickSelectionCheckbox(name: string, options?: { shift?: boolean }) {
  const checkbox = page.getByRole("checkbox", { name: `Select ${name}` });
  await expect.element(checkbox).toBeInTheDocument();

  if (options?.shift) await userEvent.keyboard("{Shift>}");
  await checkbox.click();
  if (options?.shift) await userEvent.keyboard("{/Shift}");
}

async function selectGridCard(name: string, shift = false) {
  const card = domainCard(name);
  await userEvent.hover(card);
  await clickSelectionCheckbox(name, { shift });
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

      const resumeHref = "/dashboard/add-domain?resume=true&id=domain-pending";
      await expect
        .element(page.getByRole("button", { name: /Complete Verification/ }))
        .toHaveAttribute("href", resumeHref);
      await expect
        .element(page.getByRole("link", { name: "Pending" }))
        .toHaveAttribute("href", resumeHref);
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

    it("starts and continues selection from card actions without hover", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      const alphaCard = domainCard("alpha.com");
      await userEvent.click(cardButton(alphaCard, "Actions"));
      await page.getByRole("menuitem", { name: "Select" }).click();

      const toolbar = page.getByRole("toolbar", { name: "Bulk actions" });
      await expect.element(toolbar.getByText("1 selected", { exact: true })).toBeInTheDocument();
      await expect.element(page.getByRole("checkbox", { name: "Select beta.io" })).toBeVisible();

      await page.getByRole("checkbox", { name: "Select beta.io" }).click();
      await expect.element(toolbar.getByText("2 selected", { exact: true })).toBeInTheDocument();

      await userEvent.click(cardButton(alphaCard, "Actions"));
      await page.getByRole("menuitem", { name: "Deselect" }).click();
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

      await expect
        .element(table.getByRole("button", { name: "Continue" }))
        .toHaveAttribute("href", "/dashboard/add-domain?resume=true&id=domain-pending");

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
        expect(domainNames().at(-1)).toBe("pending.dev");
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

      // Rows arrive pre-sorted by `sortDomains`, which compares with `localeCompare`;
      // a code-point sort would put every capitalized domain ahead of the lowercase ones.
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
      const { urlUpdates } = await renderDashboardShell({
        domains: makePaginationDomains(2),
        searchParams: "page=2",
      });

      await expect.element(page.getByRole("table")).toBeInTheDocument();
      await expect
        .element(page.getByRole("table").getByRole("link", { name: "site00.com" }))
        .toBeInTheDocument();
      await expect.element(page.getByText("1 of 1", { exact: true })).toBeInTheDocument();
      await vi.waitFor(() => {
        expect(urlUpdates.at(-1)).not.toMatch(/(?:^|[?&])page=/);
      });
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

    it("keeps each domain's row when the sort order changes", async () => {
      await renderDashboardShell();
      await waitForCatalog();
      await openTable();

      const rowOf = (name: string) =>
        page.getByRole("table").getByRole("link", { name }).element().closest("tr");
      const alphaRow = rowOf("alpha.com");
      expect(alphaRow).not.toBeNull();
      const before = domainNames().indexOf("alpha.com");

      await page.getByRole("button", { name: /^Domain$/ }).click();
      await vi.waitFor(() => {
        expect(domainNames().indexOf("alpha.com")).not.toBe(before);
      });

      // Rows keyed by position would reuse this <tr> for whichever domain now sorts first.
      expect(rowOf("alpha.com")).toBe(alphaRow);
    });

    it("keeps an unverified row aligned with the header when Status is hidden", async () => {
      await renderDashboardShell();
      await waitForCatalog();
      await openTable();

      await page.getByRole("button", { name: "Toggle columns" }).first().click();
      await page.getByRole("menuitemcheckbox", { name: /Status/ }).click();
      await expect.element(page.getByRole("button", { name: /^Status$/ })).not.toBeInTheDocument();

      const spanOf = (cells: Iterable<HTMLTableCellElement>) =>
        Array.from(cells).reduce((sum, cell) => sum + cell.colSpan, 0);
      const table = page.getByRole("table").element() as HTMLTableElement;
      const headerSpan = spanOf(table.tHead!.rows[0].cells);
      const pendingRow = page
        .getByRole("table")
        .getByRole("link", { name: "pending.dev" })
        .element()
        .closest("tr")!;

      expect(spanOf(pendingRow.cells)).toBe(headerSpan);
      await expect
        .element(page.getByRole("table").getByRole("button", { name: "Continue" }))
        .toBeInTheDocument();
    });

    it("keeps an unverified row aligned when every hideable column is hidden", async () => {
      usePreferencesStore.setState({
        columnVisibility: Object.fromEntries(HIDEABLE_COLUMNS.map(({ id }) => [id, false])),
      });
      await renderDashboardShell();
      await waitForCatalog();
      await openTable();

      const table = page.getByRole("table").element() as HTMLTableElement;
      const pendingRow = page
        .getByRole("table")
        .getByRole("link", { name: "pending.dev" })
        .element()
        .closest("tr")!;
      const spanOf = (cells: Iterable<HTMLTableCellElement>) =>
        Array.from(cells).reduce((sum, cell) => sum + cell.colSpan, 0);

      expect(spanOf(pendingRow.cells)).toBe(spanOf(table.tHead!.rows[0].cells));
      await userEvent.click(pendingRow.querySelector("td:last-child button")!);
      await expect
        .element(page.getByRole("menuitem", { name: "Continue verification" }))
        .toHaveAttribute("href", "/dashboard/add-domain?resume=true&id=domain-pending");
    });

    it("keeps required columns visible despite invalid saved preferences", async () => {
      usePreferencesStore.setState({
        columnVisibility: { select: false, domainName: false, actions: false },
      });
      await renderDashboardShell();
      await waitForCatalog();
      await openTable();

      const table = page.getByRole("table").element() as HTMLTableElement;
      const pendingRow = page
        .getByRole("table")
        .getByRole("link", { name: "pending.dev" })
        .element()
        .closest("tr")!;
      const spanOf = (cells: Iterable<HTMLTableCellElement>) =>
        Array.from(cells).reduce((sum, cell) => sum + cell.colSpan, 0);

      expect(spanOf(pendingRow.cells)).toBe(spanOf(table.tHead!.rows[0].cells));
      await expect.element(page.getByRole("button", { name: /^Domain$/ })).toBeInTheDocument();
      await expect
        .element(page.getByRole("checkbox", { name: "Select pending.dev" }))
        .toBeInTheDocument();
      expect(pendingRow.querySelector("td:last-child button")).not.toBeNull();
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

    it("ignores TLDs and providers in the URL that no domain has", async () => {
      await renderDashboardShell({ searchParams: "tlds=nope&providers=bogus" });
      await waitForCatalog();
      expect(domainNames()).toHaveLength(4);
      await expect
        .element(page.getByRole("button", { name: "Clear all" }).first())
        .not.toBeInTheDocument();
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
    it("selects all visible domains with Mod+A in grid and table views", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await pressSelectAllHotkey();
      await expect
        .element(page.getByRole("toolbar", { name: "Bulk actions" }).getByText("4 selected"))
        .toBeInTheDocument();

      await userEvent.keyboard("{Escape}");
      await page.getByRole("button", { name: "Table view" }).click();
      await pressSelectAllHotkey();
      await expect
        .element(page.getByRole("toolbar", { name: "Bulk actions" }).getByText("4 selected"))
        .toBeInTheDocument();
    });

    it("selects domains across table pages with Mod+A", async () => {
      usePreferencesStore.setState({ viewMode: "table" });
      await renderDashboardShell({ domains: makePaginationDomains(12) });
      await expect.element(page.getByText("1 of 2", { exact: true })).toBeInTheDocument();

      await pressSelectAllHotkey();
      await expect
        .element(page.getByRole("toolbar", { name: "Bulk actions" }).getByText("12 selected"))
        .toBeInTheDocument();
    });

    it("leaves Mod+A to native text selection inside search", async () => {
      await renderDashboardShell();
      await waitForCatalog();
      const search = page.getByRole("textbox", { name: "Search domains" }).first();

      await search.fill("alpha");
      await search.click();
      await pressSelectAllHotkey();

      const input = search.element() as HTMLInputElement;
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);
      await expect
        .element(page.getByRole("toolbar", { name: "Bulk actions" }))
        .not.toBeInTheDocument();
    });

    it("applies additive Shift ranges and endpoint deselection in the grid", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await selectGridCard("pending.dev");
      await selectGridCard("alpha.com");
      await selectGridCard("gamma.com", true);
      const toolbar = page.getByRole("toolbar", { name: "Bulk actions" });
      await expect.element(toolbar.getByText("4 selected")).toBeInTheDocument();

      await selectGridCard("beta.io", true);
      await expect.element(toolbar.getByText("2 selected")).toBeInTheDocument();
      await expect.element(page.getByRole("checkbox", { name: "Select alpha.com" })).toBeChecked();
      await expect
        .element(page.getByRole("checkbox", { name: "Select pending.dev" }))
        .toBeChecked();
    });

    it("applies an inclusive Shift range in the table", async () => {
      usePreferencesStore.setState({ viewMode: "table" });
      await renderDashboardShell();
      await waitForCatalog();

      await clickSelectionCheckbox("alpha.com");
      await clickSelectionCheckbox("gamma.com", { shift: true });

      const toolbar = page.getByRole("toolbar", { name: "Bulk actions" });
      await expect.element(toolbar.getByText("3 selected")).toBeInTheDocument();
      await expect.element(page.getByRole("checkbox", { name: "Select beta.io" })).toBeChecked();
    });

    it("falls back to a single selection after filters clear the range anchor", async () => {
      await renderDashboardShell();
      await waitForCatalog();
      await selectGridCard("alpha.com");

      const search = page.getByRole("textbox", { name: "Search domains" }).first();
      await search.fill("beta");
      await vi.waitFor(() => expect(domainNames()).toEqual(["beta.io"]));
      await search.fill("");
      await waitForCatalog();

      await selectGridCard("gamma.com", true);
      await expect
        .element(page.getByRole("toolbar", { name: "Bulk actions" }).getByText("1 selected"))
        .toBeInTheDocument();
    });

    it("does not run disabled dashboard commands without visible domains", async () => {
      await renderDashboardShell({ domains: [], totalDomains: 0 });

      await pressSelectAllHotkey();
      await userEvent.keyboard("{Escape}");

      await expect
        .element(page.getByRole("toolbar", { name: "Bulk actions" }))
        .not.toBeInTheDocument();
    });

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

  describe("keyboard shortcuts", () => {
    it("lists the mounted shortcuts when ? is pressed", async () => {
      await renderDashboardShell();

      await userEvent.keyboard("?");

      const dialog = page.getByRole("dialog", { name: "Keyboard Shortcuts" });
      await expect.element(dialog).toBeInTheDocument();
      // Opens onto the dialog itself, not the scrollable list (no stray focus ring).
      await expect.element(dialog).toHaveFocus();
      await expect.element(dialog.getByRole("heading", { name: "Global" })).toBeInTheDocument();
      await expect.element(dialog.getByText("Show keyboard shortcuts")).toBeInTheDocument();
      await expect.element(dialog.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
      await expect.element(dialog.getByText("Filter domains")).toBeInTheDocument();
      await expect.element(dialog.getByRole("heading", { name: "Selection" })).toBeInTheDocument();
      await expect.element(dialog.getByText("Select all domains")).toBeInTheDocument();
      await expect.element(dialog.getByText("Clear domain selection")).toBeInTheDocument();
      await expect.element(dialog.getByText("Select a range")).toBeInTheDocument();
    });

    it("clears the search on Escape, then leaves the empty field", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      const search = page.getByRole("textbox", { name: "Search domains" });
      await search.fill("alpha");
      await vi.waitFor(() => {
        expect(domainNames()).toEqual(["alpha.com"]);
      });

      await userEvent.keyboard("{Escape}");
      await expect.element(search).toHaveValue("");
      await expect.element(search).toHaveFocus();

      await userEvent.keyboard("{Escape}");
      await expect.element(search).not.toHaveFocus();
    });

    it("keeps the selection when Escape leaves the empty search field", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await selectGridCard("alpha.com");
      const search = page.getByRole("textbox", { name: "Search domains" });
      await search.click();
      await expect.element(search).toHaveFocus();

      await userEvent.keyboard("{Escape}");
      await expect.element(search).not.toHaveFocus();
      await expect
        .element(
          page
            .getByRole("toolbar", { name: "Bulk actions" })
            .getByText("1 selected", { exact: true }),
        )
        .toBeInTheDocument();
    });

    it("keeps the selection when Escape closes a filter dropdown", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await selectGridCard("alpha.com");
      await getFilterTrigger(/TLD/i).click();
      const listbox = page.getByRole("listbox");
      await expect.element(listbox).toBeInTheDocument();

      await userEvent.keyboard("{Escape}");
      await expect.element(listbox).not.toBeInTheDocument();
      await expect
        .element(
          page
            .getByRole("toolbar", { name: "Bulk actions" })
            .getByText("1 selected", { exact: true }),
        )
        .toBeInTheDocument();
    });

    it("keeps the selection when Escape cancels an IME composition", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await selectGridCard("alpha.com");
      const search = page.getByRole("textbox", { name: "Search domains" });
      await search.click();
      search
        .element()
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", isComposing: true, bubbles: true }),
        );

      await expect
        .element(
          page
            .getByRole("toolbar", { name: "Bulk actions" })
            .getByText("1 selected", { exact: true }),
        )
        .toBeInTheDocument();
    });

    it("leaves Mod+A to the open shortcuts dialog", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await userEvent.keyboard("?");
      await expect
        .element(page.getByRole("dialog", { name: "Keyboard Shortcuts" }))
        .toBeInTheDocument();

      await pressSelectAllHotkey();
      await expect
        .element(page.getByRole("toolbar", { name: "Bulk actions" }))
        .not.toBeInTheDocument();
    });

    it("keeps the selection when Escape closes the shortcuts dialog", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await selectGridCard("alpha.com");
      await userEvent.keyboard("?");
      const dialog = page.getByRole("dialog", { name: "Keyboard Shortcuts" });
      await expect.element(dialog).toBeInTheDocument();

      await userEvent.keyboard("{Escape}");
      await expect.element(dialog).not.toBeInTheDocument();
      await expect
        .element(
          page
            .getByRole("toolbar", { name: "Bulk actions" })
            .getByText("1 selected", { exact: true }),
        )
        .toBeInTheDocument();
    });

    it("keeps the selection when Escape cancels a bulk confirm dialog", async () => {
      await renderDashboardConfirmShell();
      await waitForCatalog();

      await selectGridCard("alpha.com");
      await selectGridCard("beta.io");
      const toolbar = page.getByRole("toolbar", { name: "Bulk actions" });
      await toolbar.getByRole("button", { name: "Delete" }).click();
      await expect.element(page.getByRole("alertdialog")).toBeInTheDocument();

      await userEvent.keyboard("{Escape}");
      await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
      expect(dashboardActionSpies.onBulkDelete).not.toHaveBeenCalled();
      await expect.element(toolbar.getByText("2 selected", { exact: true })).toBeInTheDocument();
    });
  });

  describe("bulk and view hotkeys", () => {
    it("archives the selection with E", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await selectGridCard("alpha.com");
      await selectGridCard("beta.io");
      await userEvent.keyboard("e");

      expect(dashboardActionSpies.onBulkArchive).toHaveBeenCalledWith([
        "domain-alpha",
        "domain-beta",
      ]);
    });

    it("mutes with M, or unmutes when every selected domain is muted", async () => {
      const domains = makeDashboardDomains();
      for (const domain of domains) {
        if (domain.domainName === "alpha.com") domain.muted = true;
      }
      await renderDashboardShell({ domains });
      await waitForCatalog();

      await selectGridCard("alpha.com");
      await userEvent.keyboard("m");
      expect(dashboardActionSpies.onBulkMute).toHaveBeenLastCalledWith(["domain-alpha"], false);

      await selectGridCard("beta.io");
      await userEvent.keyboard("m");
      expect(dashboardActionSpies.onBulkMute).toHaveBeenLastCalledWith(
        ["domain-alpha", "domain-beta"],
        true,
      );
    });

    it("confirms before deleting with #, and ignores other keys in the dialog", async () => {
      await renderDashboardConfirmShell();
      await waitForCatalog();

      await selectGridCard("alpha.com");
      await userEvent.keyboard("#");
      await expect.element(page.getByRole("alertdialog")).toBeInTheDocument();
      expect(dashboardActionSpies.onBulkDelete).not.toHaveBeenCalled();

      await userEvent.keyboard("m");
      expect(dashboardActionSpies.onBulkMute).not.toHaveBeenCalled();
    });

    it("leaves single-key presses to an open menu", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await selectGridCard("alpha.com");
      await page.getByRole("button", { name: /^Sort:/ }).click();
      const item = page.getByRole("menuitemradio").first();
      await expect.element(item).toBeInTheDocument();

      // The menu's typeahead prevents every character key itself, so assert the
      // outcome rather than `defaultPrevented`: the menu takes "e" (typeahead
      // jumps to "Expiry…") and the archive command doesn't run.
      item
        .element()
        .dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true, cancelable: true }));

      await expect
        .element(page.getByRole("menuitemradio", { name: "Expiry (Soonest first)" }))
        .toHaveAttribute("data-highlighted");
      expect(dashboardActionSpies.onBulkArchive).not.toHaveBeenCalled();
    });

    it("does not run bulk hotkeys without a selection or while typing", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await userEvent.keyboard("e");
      expect(dashboardActionSpies.onBulkArchive).not.toHaveBeenCalled();

      await selectGridCard("alpha.com");
      await page.getByRole("textbox", { name: "Search domains" }).click();
      await userEvent.keyboard("em");
      expect(dashboardActionSpies.onBulkArchive).not.toHaveBeenCalled();
      expect(dashboardActionSpies.onBulkMute).not.toHaveBeenCalled();
    });

    it("focuses the dashboard search with / without typing the slash", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await userEvent.keyboard("/");

      const search = page.getByRole("textbox", { name: "Search domains" });
      await expect.element(search).toHaveFocus();
      await expect.element(search).toHaveValue("");
    });

    it("switches between grid and table with V", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await userEvent.keyboard("v");
      await expect.element(page.getByRole("table")).toBeInTheDocument();

      await userEvent.keyboard("v");
      await expect.element(page.getByRole("table")).not.toBeInTheDocument();
    });

    it("opens add-domain with N", async () => {
      await renderDashboardShell();
      await waitForCatalog();

      await userEvent.keyboard("n");
      expect(routerSpies.push).toHaveBeenCalledWith("/dashboard/add-domain", { scroll: false });
    });

    it("ignores N when the domain quota is reached", async () => {
      mockSubscription.canAddMore = false;
      await renderDashboardShell();
      await waitForCatalog();

      await userEvent.keyboard("n");
      expect(routerSpies.push).not.toHaveBeenCalled();
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
