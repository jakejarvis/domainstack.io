import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { AppHeaderActionCluster } from "@/components/layout/app-header-action-cluster";
import { AppHeaderGrid } from "@/components/layout/app-header-grid";
import { MobileSearchProvider } from "@/components/layout/mobile-search-context";
import { Logo } from "@/components/logo";
import { HeaderSearchClient } from "@/components/search/header-search-client";
import { MobileSearchToggle } from "@/components/search/mobile-search-toggle";
import { render } from "@/mocks/react";

const nav = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void | Promise<void>>(),
  params: {} as { domain?: string },
  segment: "domain" as string | null,
}));

vi.mock("@/hooks/use-router", () => ({
  useRouter: () => ({ push: nav.push }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => nav.params,
  useSelectedLayoutSegment: () => nav.segment,
}));

const DESKTOP = { width: 1280, height: 720 };
const MOBILE = { width: 390, height: 844 };

/**
 * Mirrors `AppHeader` so the real grid collapse is under test. The "Dashboard"
 * button stands in for the action cluster, so tests can tell it is reachable.
 */
function Header() {
  return (
    <MobileSearchProvider>
      <AppHeaderGrid>
        <Logo className="size-8" />
        <HeaderSearchClient />
        <AppHeaderActionCluster>
          <MobileSearchToggle />
          <button type="button">Dashboard</button>
        </AppHeaderActionCluster>
      </AppHeaderGrid>
    </MobileSearchProvider>
  );
}

function toggle() {
  return page.getByRole("button", { name: "Search" });
}

function searchInput() {
  return page.getByRole("textbox", { name: "Domain" });
}

/** Raw DOM lookup — unlike `getByRole` this also finds CSS-hidden elements. */
function toggleElement() {
  return document.querySelector<HTMLButtonElement>('button[aria-label="Search"]');
}

function searchWrapper() {
  return document.getElementById("header-search");
}

function searchVisibility() {
  const el = searchWrapper();
  return el ? getComputedStyle(el).visibility : null;
}

describe("mobile header search", () => {
  beforeEach(() => {
    nav.push.mockClear();
    nav.params = {};
    nav.segment = "domain";
  });

  afterEach(async () => {
    await page.viewport(DESKTOP.width, DESKTOP.height);
  });

  it("starts collapsed and expands on tap, focusing the input", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    await render(<Header />);

    await expect.element(toggle()).toHaveAttribute("aria-expanded", "false");
    // Stays mounted so `open()` can focus it in the tap gesture; `visibility`
    // is what keeps it off-limits until then.
    await expect.poll(searchVisibility).toBe("hidden");

    await toggle().click();

    await expect.element(toggle()).toHaveAttribute("aria-expanded", "true");
    await expect.element(searchInput()).toHaveFocus();
    expect(searchVisibility()).toBe("visible");
  });

  it("gates the collapsed search in CSS, not JS", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    await render(<Header />);

    // `useIsMobile()` is false until after the first paint, but the SSR markup
    // is already collapsed — gating on JS would leave the input tabbable for
    // that whole window.
    const wrapper = searchWrapper();
    expect(wrapper?.hasAttribute("inert")).toBe(false);
    expect(wrapper?.className).toContain("invisible");
    expect(wrapper?.className).toContain("md:visible");
  });

  it("collapses on Escape and returns focus to the toggle", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    await render(<Header />);

    await toggle().click();
    await expect.element(searchInput()).toHaveFocus();

    await userEvent.keyboard("{Escape}");

    await expect.element(toggle()).toHaveAttribute("aria-expanded", "false");
    await expect.element(toggle()).toHaveFocus();
  });

  it("collapses via the close button and returns focus to the toggle", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    await render(<Header />);

    await toggle().click();
    await expect.element(toggle()).toHaveAttribute("aria-expanded", "true");

    await page.getByRole("button", { name: "Close search" }).click();

    await expect.element(toggle()).toHaveAttribute("aria-expanded", "false");
    // The button must outlive the input's blur-close, or the dismissal
    // downgrades to a plain close and focus is stranded on the body.
    await expect.element(toggle()).toHaveFocus();
  });

  it("stays expanded when blurred with a typed query, and collapses when untouched", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    await render(<Header />);

    // Typed but not submitted: blurring must not discard the in-progress query.
    await toggle().click();
    await userEvent.fill(searchInput(), "example.com");
    searchInput().element().blur();
    await expect.element(toggle()).toHaveAttribute("aria-expanded", "true");

    // Cleared back to the initial value: nothing to lose, so it collapses.
    await userEvent.fill(searchInput(), "");
    searchInput().element().blur();
    await expect.element(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("submits and collapses", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    await render(<Header />);

    await toggle().click();
    await userEvent.fill(searchInput(), "example.com");
    await userEvent.keyboard("{Enter}");

    expect(nav.push).toHaveBeenCalledWith("/example.com");
    await expect.element(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the search open and focused when an empty query is submitted", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    await render(<Header />);

    await toggle().click();
    await userEvent.keyboard("{Enter}");

    expect(nav.push).not.toHaveBeenCalled();
    // The search must not collapse out from under its own validation toast.
    await expect.element(toggle()).toHaveAttribute("aria-expanded", "true");
    await expect.element(searchInput()).toHaveFocus();
  });

  it("closes an open search when navigating to the landing page", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    const { rerender } = await render(<Header />);

    await toggle().click();
    await expect.element(toggle()).toHaveAttribute("aria-expanded", "true");

    // No toggle on the landing page, so a search surviving the navigation
    // would strand the action cluster hidden and inert.
    nav.segment = null;
    await rerender(<Header />);

    // Assert the mechanism: Playwright counts `inert` and `opacity: 0`
    // elements as visible, so `toBeVisible()` would pass either way.
    const dashboard = document.querySelector<HTMLElement>("button:not([aria-label])");
    await expect.poll(() => dashboard?.closest("[inert]")).toBeNull();
    // Polled, not sampled — the cluster springs back from opacity 0.
    await expect
      .poll(() => Number(getComputedStyle(dashboard!.parentElement!).opacity))
      .toBeGreaterThan(0.99);
  });

  it("does not render the toggle at all on the landing page", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    nav.segment = null;
    await render(<Header />);

    // Genuinely absent — `MobileSearchToggle` returns null here.
    expect(toggleElement()).toBeNull();
  });

  it("exposes the input directly on desktop, with the toggle CSS-hidden", async () => {
    await page.viewport(DESKTOP.width, DESKTOP.height);
    await render(<Header />);

    await expect.element(searchInput()).toBeEnabled();
    expect(searchVisibility()).toBe("visible");
    // Mounted but hidden by `md:hidden` — unlike the landing page above.
    expect(toggleElement()).not.toBeNull();
    expect(getComputedStyle(toggleElement()!).display).toBe("none");
  });
});
