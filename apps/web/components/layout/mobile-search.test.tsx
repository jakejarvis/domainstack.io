import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { AppHeaderGrid } from "@/components/layout/app-header-grid";
import { AppHeaderSlideOver } from "@/components/layout/app-header-slideover";
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
 * Mirrors `AppHeader`'s structure so the real grid collapse is under test: the
 * toggle sits in the icon cluster, the input in the middle column that shrinks
 * to 0px while collapsed. The extra "Dashboard" button stands in for the rest of
 * the action cluster, so tests can tell whether the cluster is reachable.
 */
function Header() {
  return (
    <MobileSearchProvider>
      <AppHeaderGrid>
        <Logo className="size-8" />
        <HeaderSearchClient />
        <AppHeaderSlideOver>
          <MobileSearchToggle />
          <button type="button">Dashboard</button>
        </AppHeaderSlideOver>
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
    // The input stays mounted while collapsed so `open()` can focus it inside the
    // tap gesture; `visibility` is what keeps it off-limits until then.
    await expect.poll(searchVisibility).toBe("hidden");

    await toggle().click();

    await expect.element(toggle()).toHaveAttribute("aria-expanded", "true");
    await expect.element(searchInput()).toHaveFocus();
    expect(searchVisibility()).toBe("visible");
  });

  it("gates the collapsed search in CSS, not JS", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    await render(<Header />);

    // `useIsMobile()` reports false until after the first paint, while the
    // collapsed grid template is already in the SSR markup. Gating on a JS
    // breakpoint would leave the input tabbable for that whole window, so the
    // hidden state must come from the stylesheet and carry no `inert`.
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
    // The button must outlive the input's blur-close, or the dismissal downgrades
    // to a plain close and focus is stranded on the body.
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
    // Validation has to surface somewhere the user can act on it, so the search
    // must not collapse out from under the toast.
    await expect.element(toggle()).toHaveAttribute("aria-expanded", "true");
    await expect.element(searchInput()).toHaveFocus();
  });

  it("closes an open search when navigating to the landing page", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    const { rerender } = await render(<Header />);

    await toggle().click();
    await expect.element(toggle()).toHaveAttribute("aria-expanded", "true");

    // The toggle is not rendered on the landing page, so an open search that
    // survived the navigation would leave the action cluster hidden and inert
    // with nothing left to reopen it.
    nav.segment = null;
    await rerender(<Header />);

    // Assert the mechanism, not `toBeVisible()`: Playwright treats `inert` and
    // `opacity: 0` elements as visible, so a weaker check passes even when the
    // cluster is unreachable.
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
    // Mounted but hidden by `md:hidden` — distinct from the landing page above,
    // and this assertion fails if that class is ever dropped.
    expect(toggleElement()).not.toBeNull();
    expect(getComputedStyle(toggleElement()!).display).toBe("none");
  });
});
