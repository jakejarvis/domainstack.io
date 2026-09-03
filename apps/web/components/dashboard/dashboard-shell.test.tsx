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

import { makePaginationDomains, makeTrackedDomain } from "@/components/dashboard/test-fixtures";
import {
  dashboardActionSpies,
  renderDashboardShell,
  resetDashboardTestState,
} from "@/components/dashboard/test-utils";
import { usePreferencesStore } from "@/lib/stores/preferences-store";
import { screen, waitFor, within } from "@/mocks/react";

function domainNames() {
  return screen
    .queryAllByRole("link")
    .map((el) => el.textContent?.replace(/\s+/g, " ").trim() ?? "")
    .filter((name) => name.includes("."));
}

function getFilterTrigger(name: RegExp) {
  return screen.getAllByRole("combobox", { name })[0];
}

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

describe("dashboard shell", () => {
  beforeEach(() => {
    resetDashboardTestState();
  });

  afterEach(() => {
    resetDashboardTestState();
    vi.useRealTimers();
  });

  describe("view toggle and empty states", () => {
    it("renders the grid by default without a table", async () => {
      renderDashboardShell();
      await waitForCatalog();

      expect(screen.getByRole("heading", { name: /Welcome back/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Grid view" })).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(domainNames()).toEqual(
        expect.arrayContaining(["alpha.com", "beta.io", "gamma.com", "pending.dev"]),
      );
    });

    it("switches between grid and table", async () => {
      const user = userEvent.setup();
      renderDashboardShell();
      await waitForCatalog();

      await user.click(screen.getByRole("button", { name: "Table view" }));
      await waitFor(() => {
        expect(screen.getByRole("table")).toBeInTheDocument();
      });
      expect(screen.getByRole("link", { name: "alpha.com" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Grid view" }));
      await waitFor(() => {
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
      });
      expect(screen.getByRole("link", { name: "alpha.com" })).toBeInTheDocument();
    });

    it("shows the first-time empty state", () => {
      renderDashboardShell({ domains: [], totalDomains: 0 });

      expect(screen.getByText("Start tracking your domains")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Add Your First Domain/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Grid view" })).not.toBeInTheDocument();
    });

    it("shows a no-matches empty state and restores cards after clearing filters", async () => {
      const user = userEvent.setup();
      renderDashboardShell();
      await waitForCatalog();

      await user.type(screen.getByRole("textbox", { name: "Search domains" }), "zzzz");
      await waitFor(() => {
        expect(screen.getByText("No domains match your filters")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Clear Filters" }));
      await waitFor(() => {
        expect(screen.getByRole("link", { name: "alpha.com" })).toBeInTheDocument();
      });
    });
  });

  describe("grid", () => {
    it("shows status badges and complete-verification on unverified cards", async () => {
      const user = userEvent.setup();
      renderDashboardShell();
      await waitForCatalog();

      expect(screen.getAllByText("Verified").length).toBeGreaterThan(0);
      expect(screen.getByText("Pending")).toBeInTheDocument();
      expect(screen.getByText("Healthy")).toBeInTheDocument();
      expect(screen.getAllByText("Needs Attention").length).toBeGreaterThan(0);

      await user.click(screen.getByRole("button", { name: /Complete Verification/ }));
      expect(dashboardActionSpies.onVerify).toHaveBeenCalledWith("domain-pending", null);
    });

    it("archives, mutes, and removes a verified card from the actions menu", async () => {
      const user = userEvent.setup();
      renderDashboardShell();
      await waitForCatalog();

      await user.click(within(domainCard("alpha.com")).getByRole("button", { name: "Actions" }));
      await user.click(screen.getByRole("menuitem", { name: "Archive" }));
      expect(dashboardActionSpies.onArchive).toHaveBeenCalledWith("domain-alpha");

      await user.click(within(domainCard("alpha.com")).getByRole("button", { name: "Actions" }));
      await user.click(screen.getByRole("menuitem", { name: "Mute" }));
      expect(dashboardActionSpies.onMute).toHaveBeenCalledWith("domain-alpha", true);

      await user.click(within(domainCard("alpha.com")).getByRole("button", { name: "Actions" }));
      await user.click(screen.getByRole("menuitem", { name: "Remove" }));
      expect(dashboardActionSpies.onRemove).toHaveBeenCalledWith("domain-alpha");
    });

    it("reorders cards from the sort dropdown", async () => {
      const user = userEvent.setup();
      const { urlUpdates } = renderDashboardShell();
      await waitForCatalog();

      await user.click(screen.getByRole("button", { name: /Sort:/ }));
      await user.click(screen.getByRole("menuitemradio", { name: "Name (Z-A)" }));

      await waitFor(() => {
        expect(domainNames()).toEqual(["pending.dev", "gamma.com", "beta.io", "alpha.com"]);
      });
      expect(urlUpdates.some((url) => url.includes("sort=domainName.desc"))).toBe(true);
    });

    it("sorts by expiry from the dropdown and keeps unverified last", async () => {
      const user = userEvent.setup();
      const { urlUpdates } = renderDashboardShell();
      await waitForCatalog();

      await user.click(screen.getByRole("button", { name: /Sort:/ }));
      await user.click(screen.getByRole("menuitemradio", { name: "Expiry (Soonest first)" }));

      await waitFor(() => {
        expect(domainNames()).toEqual(["gamma.com", "beta.io", "alpha.com", "pending.dev"]);
      });
      expect(urlUpdates.some((url) => url.includes("sort=expirationDate.asc"))).toBe(true);
    });

    it("selects a card and shows the bulk toolbar", async () => {
      const user = userEvent.setup();
      renderDashboardShell();
      await waitForCatalog();

      expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).not.toBeInTheDocument();

      await selectGridCard(user, "alpha.com");

      const toolbar = await screen.findByRole("toolbar", { name: "Bulk actions" });
      expect(within(toolbar).getByText("1 selected")).toBeInTheDocument();
    });
  });

  describe("table", () => {
    async function openTable(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole("button", { name: "Table view" }));
      await waitFor(() => {
        expect(screen.getByRole("table")).toBeInTheDocument();
      });
    }

    it("renders domain links and unverified continue/remove actions", async () => {
      const user = userEvent.setup();
      renderDashboardShell();
      await waitForCatalog();
      await openTable(user);

      const table = screen.getByRole("table");
      expect(within(table).getByRole("link", { name: "alpha.com" })).toBeInTheDocument();

      await user.click(within(table).getByRole("button", { name: "Continue" }));
      expect(dashboardActionSpies.onVerify).toHaveBeenCalledWith("domain-pending", null);

      await user.click(within(table).getByRole("button", { name: "Remove" }));
      expect(dashboardActionSpies.onRemove).toHaveBeenCalledWith("domain-pending");
    });

    it("toggles sort from the domain header and keeps unverified last on expiry", async () => {
      const user = userEvent.setup();
      const { urlUpdates } = renderDashboardShell();
      await waitForCatalog();
      await openTable(user);

      await user.click(screen.getByRole("button", { name: /^Domain$/ }));
      await waitFor(() => {
        expect(urlUpdates.some((url) => url.includes("sort=domainName.desc"))).toBe(true);
      });

      await user.click(screen.getByRole("button", { name: /^Expires$/ }));
      await waitFor(() => {
        const names = within(screen.getByRole("table"))
          .getAllByRole("link")
          .map((el) => el.textContent?.trim());
        expect(names.at(-1)).toBe("pending.dev");
      });
    });

    it("sorts the domain column case-insensitively", async () => {
      const user = userEvent.setup();
      renderDashboardShell({
        domains: [
          makeTrackedDomain({ id: "domain-zeta", domainName: "Zeta.com" }),
          makeTrackedDomain({ id: "domain-alpha", domainName: "alpha.com" }),
          makeTrackedDomain({ id: "domain-beta", domainName: "Beta.io" }),
        ],
      });
      await waitForCatalog();
      await openTable(user);

      // The domain column has no explicit `sortFn`, so it resolves `"auto"` ->
      // `text` from the registry on `dashboardTableFeatures`. Without that
      // registration it silently falls back to `basic`, which sorts by code
      // point and puts every capitalized domain ahead of the lowercase ones.
      await waitFor(() => {
        const names = within(screen.getByRole("table"))
          .getAllByRole("link")
          .map((el) => el.textContent?.trim());
        expect(names).toEqual(["alpha.com", "Beta.io", "Zeta.com"]);
      });
    });

    it("paginates and resets the page when page size changes", async () => {
      const user = userEvent.setup();
      const { urlUpdates } = renderDashboardShell({ domains: makePaginationDomains(12) });
      await waitFor(() => {
        expect(screen.getByRole("link", { name: "site00.com" })).toBeInTheDocument();
      });
      await openTable(user);

      const table = screen.getByRole("table");
      expect(within(table).getAllByRole("link")).toHaveLength(10);
      expect(screen.getByText("1 of 2")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Go to next page" }));
      await waitFor(() => {
        expect(screen.getByText("2 of 2")).toBeInTheDocument();
        expect(
          within(screen.getByRole("table")).queryByRole("link", { name: "site00.com" }),
        ).not.toBeInTheDocument();
        expect(within(screen.getByRole("table")).getAllByRole("link")).toHaveLength(2);
      });
      expect(urlUpdates.some((url) => /(?:^|[?&])page=2(?:&|$)/.test(url))).toBe(true);

      const pageSize = screen.getByRole("combobox", { name: "Domains per page" });
      await user.click(pageSize);
      await user.click(await screen.findByRole("option", { name: "25" }));
      await waitFor(() => {
        expect(within(screen.getByRole("table")).getAllByRole("link")).toHaveLength(12);
      });
      expect(screen.getByText("1 of 1")).toBeInTheDocument();
    });

    it("returns to page 1 when filters change even if page 2 still has rows", async () => {
      const user = userEvent.setup();
      usePreferencesStore.setState({ viewMode: "table" });
      renderDashboardShell({
        domains: makePaginationDomains(12),
        searchParams: "page=2",
      });

      await waitFor(() => {
        expect(screen.getByText("2 of 2")).toBeInTheDocument();
        expect(
          within(screen.getByRole("table")).queryByRole("link", { name: "site00.com" }),
        ).not.toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Grid view" }));
      // "s" still matches all 12 sites, so clamp alone would leave page 2 empty of site00.
      await user.type(screen.getAllByRole("textbox", { name: "Search domains" })[0], "s");
      await waitFor(() => {
        expect(domainNames()).toEqual(expect.arrayContaining(["site00.com", "site11.com"]));
      });

      await user.click(screen.getByRole("button", { name: "Table view" }));
      await waitFor(() => {
        expect(
          within(screen.getByRole("table")).getByRole("link", { name: "site00.com" }),
        ).toBeInTheDocument();
        expect(screen.getByText("1 of 2")).toBeInTheDocument();
      });
    });

    it("clamps an impossible deep-linked page to page 1", async () => {
      usePreferencesStore.setState({ viewMode: "table" });
      renderDashboardShell({
        domains: makePaginationDomains(2),
        searchParams: "page=2",
      });

      await waitFor(() => {
        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(
          within(screen.getByRole("table")).getByRole("link", { name: "site00.com" }),
        ).toBeInTheDocument();
        expect(screen.getByText("1 of 1")).toBeInTheDocument();
      });
    });

    it("keeps a deep-linked page when filters are not changed", async () => {
      const user = userEvent.setup();
      usePreferencesStore.setState({ viewMode: "table" });
      renderDashboardShell({
        domains: makePaginationDomains(12),
        searchParams: "page=2",
      });

      await waitFor(() => {
        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(screen.getByText("2 of 2")).toBeInTheDocument();
      });
      expect(
        within(screen.getByRole("table")).queryByRole("link", { name: "site00.com" }),
      ).not.toBeInTheDocument();
      expect(within(screen.getByRole("table")).getAllByRole("link")).toHaveLength(2);

      await user.click(screen.getByRole("button", { name: "Go to previous page" }));
      await waitFor(() => {
        expect(
          within(screen.getByRole("table")).getByRole("link", { name: "site00.com" }),
        ).toBeInTheDocument();
      });
    });

    it("hides and restores a column from the column menu", async () => {
      const user = userEvent.setup();
      renderDashboardShell();
      await waitForCatalog();
      await openTable(user);

      expect(screen.getByRole("button", { name: /^Registrar$/ })).toBeInTheDocument();

      await user.click(screen.getAllByRole("button", { name: "Toggle columns" })[0]);
      await user.click(await screen.findByRole("menuitemcheckbox", { name: /Registrar/ }));

      await waitFor(() => {
        expect(screen.queryByRole("button", { name: /^Registrar$/ })).not.toBeInTheDocument();
      });

      await user.click(screen.getByRole("menuitem", { name: /Show all columns/ }));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^Registrar$/ })).toBeInTheDocument();
      });
    });

    it("selects a row and shows the bulk toolbar", async () => {
      const user = userEvent.setup();
      renderDashboardShell();
      await waitForCatalog();
      await openTable(user);

      await user.click(screen.getByRole("checkbox", { name: "Select alpha.com" }));
      expect(await screen.findByRole("toolbar", { name: "Bulk actions" })).toBeInTheDocument();
    });
  });

  describe("filters", () => {
    it("filters by search and restores after clearing the chip", async () => {
      const user = userEvent.setup();
      renderDashboardShell();
      await waitForCatalog();

      await user.type(screen.getByRole("textbox", { name: "Search domains" }), "beta");
      await waitFor(() => {
        expect(domainNames()).toEqual(["beta.io"]);
      });
      expect(screen.getByText('"beta"')).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Remove search filter" }));
      await waitFor(() => {
        expect(domainNames()).toEqual(expect.arrayContaining(["alpha.com", "beta.io"]));
      });
    });

    it("filters by health from the dropdown and supports clear all", async () => {
      const user = userEvent.setup();
      renderDashboardShell();
      await waitForCatalog();

      await user.click(getFilterTrigger(/^Health/));
      await user.click(await screen.findByRole("option", { name: "Expiring Soon" }));

      await waitFor(() => {
        expect(domainNames()).toEqual(["beta.io"]);
      });
      expect(screen.getByRole("button", { name: "Remove health filter" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Clear all" }));
      await waitFor(() => {
        expect(domainNames()).toEqual(expect.arrayContaining(["alpha.com", "gamma.com"]));
      });
    });

    it("filters by TLD and provider from initial search params", async () => {
      renderDashboardShell({ searchParams: "tlds=io" });
      await waitFor(() => {
        expect(domainNames()).toEqual(["beta.io"]);
      });
      expect(screen.getByText(".io")).toBeInTheDocument();
    });

    it("filters by provider from initial search params", async () => {
      renderDashboardShell({ searchParams: "providers=cloudflare" });
      await waitFor(() => {
        expect(domainNames().sort()).toEqual(["alpha.com", "beta.io"]);
      });
    });

    it("applies pending and expiring filters from the health summary", async () => {
      const user = userEvent.setup();
      renderDashboardShell();
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Filter by pending verification" }),
        ).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: "Filter by expiring domains" })).toHaveTextContent(
        "1expiring soon",
      );

      await user.click(screen.getByRole("button", { name: "Filter by pending verification" }));
      await waitFor(() => {
        expect(domainNames()).toEqual(["pending.dev"]);
      });
      expect(screen.getByRole("button", { name: "Remove status filter" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Clear all" }));
      await user.click(screen.getByRole("button", { name: "Filter by expiring domains" }));
      await waitFor(() => {
        expect(domainNames()).toEqual(["beta.io"]);
      });
    });

    it("removes one chip without clearing the rest", async () => {
      const user = userEvent.setup();
      renderDashboardShell({ searchParams: "search=a&tlds=com" });
      await waitFor(() => {
        expect(domainNames().sort()).toEqual(["alpha.com", "gamma.com"]);
      });

      await user.click(screen.getByRole("button", { name: "Remove tld filter" }));
      await waitFor(() => {
        expect(domainNames()).toEqual(expect.arrayContaining(["alpha.com", "beta.io"]));
      });
      expect(screen.getByText('"a"')).toBeInTheDocument();
    });

    it("pins a domain from domainId search params", async () => {
      renderDashboardShell({ searchParams: "domainId=domain-alpha" });
      await waitFor(() => {
        expect(domainNames()).toEqual(["alpha.com"]);
      });
      expect(screen.getByRole("link", { name: "alpha.com" })).toBeInTheDocument();
      expect(screen.getByText("Domain:")).toBeInTheDocument();
    });
  });

  describe("bulk toolbar", () => {
    it("archives, deletes, mutes, unmutes, cancels, and select-alls visible ids", async () => {
      const user = userEvent.setup();
      renderDashboardShell();
      await waitForCatalog();

      await selectGridCard(user, "alpha.com");
      await selectGridCard(user, "beta.io");

      const toolbar = await screen.findByRole("toolbar", { name: "Bulk actions" });
      expect(within(toolbar).getByText("2 selected")).toBeInTheDocument();

      await user.click(within(toolbar).getByRole("button", { name: "Mute" }));
      expect(dashboardActionSpies.onBulkMute).toHaveBeenCalledWith(
        ["domain-alpha", "domain-beta"],
        true,
      );

      await user.click(within(toolbar).getByRole("button", { name: "Unmute" }));
      expect(dashboardActionSpies.onBulkMute).toHaveBeenCalledWith(
        ["domain-alpha", "domain-beta"],
        false,
      );

      await user.click(within(toolbar).getByRole("button", { name: "Archive" }));
      expect(dashboardActionSpies.onBulkArchive).toHaveBeenCalledWith([
        "domain-alpha",
        "domain-beta",
      ]);

      await user.click(within(toolbar).getByRole("button", { name: "Delete" }));
      expect(dashboardActionSpies.onBulkDelete).toHaveBeenCalledWith([
        "domain-alpha",
        "domain-beta",
      ]);

      await user.click(within(toolbar).getByRole("button", { name: "Cancel selection" }));
      await waitFor(() => {
        expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).not.toBeInTheDocument();
      });

      await selectGridCard(user, "alpha.com");
      const toolbarAgain = await screen.findByRole("toolbar", { name: "Bulk actions" });
      await user.click(within(toolbarAgain).getByRole("checkbox"));
      await waitFor(() => {
        expect(within(toolbarAgain).getByText("4 selected")).toBeInTheDocument();
      });
    });

    it("selects only the filtered visible ids", async () => {
      const user = userEvent.setup();
      renderDashboardShell({ searchParams: "tlds=com" });
      await waitFor(() => {
        expect(domainNames().sort()).toEqual(["alpha.com", "gamma.com"]);
      });

      await selectGridCard(user, "alpha.com");
      const toolbar = await screen.findByRole("toolbar", { name: "Bulk actions" });
      await user.click(within(toolbar).getByRole("checkbox"));
      await waitFor(() => {
        expect(within(toolbar).getByText("2 selected")).toBeInTheDocument();
      });
    });

    it("drops hidden domains from the selection when filters change", async () => {
      const user = userEvent.setup();
      renderDashboardShell();
      await waitForCatalog();

      await selectGridCard(user, "alpha.com");
      expect(await screen.findByRole("toolbar", { name: "Bulk actions" })).toBeInTheDocument();

      await user.type(screen.getByRole("textbox", { name: "Search domains" }), "beta");
      await waitFor(() => {
        expect(domainNames()).toEqual(["beta.io"]);
        expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).not.toBeInTheDocument();
      });
    });

    it("clears selection on Escape", async () => {
      const user = userEvent.setup();
      renderDashboardShell();
      await waitForCatalog();

      await selectGridCard(user, "alpha.com");
      expect(await screen.findByRole("toolbar", { name: "Bulk actions" })).toBeInTheDocument();

      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("toolbar", { name: "Bulk actions" })).not.toBeInTheDocument();
      });
    });
  });

  describe("preferences", () => {
    it("opens in table view when the preference is already table", async () => {
      usePreferencesStore.setState({ viewMode: "table" });
      renderDashboardShell();
      await waitFor(() => {
        expect(screen.getByRole("table")).toBeInTheDocument();
      });
      // Stay mounted long enough that a table-wrapper setState loop would throw.
      await waitFor(() => {
        expect(screen.getByRole("link", { name: "alpha.com" })).toBeInTheDocument();
      });
    });
  });
});
