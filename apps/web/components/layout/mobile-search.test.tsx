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
 * to 0px while collapsed.
 */
function Header() {
  return (
    <MobileSearchProvider>
      <AppHeaderGrid>
        <Logo className="size-8" />
        <HeaderSearchClient />
        <AppHeaderSlideOver>
          <MobileSearchToggle />
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

/** The collapsed search column is clipped to 0px, so `inert` is what actually gates access. */
function isSearchInert() {
  return document.getElementById("header-search")?.hasAttribute("inert") ?? null;
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
    // tap gesture; `inert` is what keeps it off-limits until then.
    await expect.poll(isSearchInert).toBe(true);

    await toggle().click();

    await expect.element(toggle()).toHaveAttribute("aria-expanded", "true");
    await expect.element(searchInput()).toHaveFocus();
    expect(isSearchInert()).toBe(false);
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

  it("collapses via the close button", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    await render(<Header />);

    await toggle().click();
    await expect.element(toggle()).toHaveAttribute("aria-expanded", "true");

    await page.getByRole("button", { name: "Close search" }).click();

    await expect.element(toggle()).toHaveAttribute("aria-expanded", "false");
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

  it("hides the toggle on the landing page", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    nav.segment = null;
    await render(<Header />);

    await expect.element(toggle()).not.toBeInTheDocument();
  });

  it("exposes the input directly on desktop, with no toggle", async () => {
    await page.viewport(DESKTOP.width, DESKTOP.height);
    await render(<Header />);

    await expect.element(searchInput()).toBeEnabled();
    await expect.element(toggle()).not.toBeInTheDocument();
  });
});
