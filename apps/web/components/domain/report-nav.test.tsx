import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import { SectionNav } from "@/components/domain/report-nav";
import { sections } from "@/lib/constants/sections";
import { render } from "@/mocks/react";

vi.mock("@/components/icons/favicon", () => ({ Favicon: () => null }));

const DESKTOP = { width: 1280, height: 720 };
const MOBILE = { width: 390, height: 844 };

function Harness({ scrolledAway }: { scrolledAway: boolean }) {
  return (
    <div style={{ "--header-height": "72px" } as React.CSSProperties}>
      <header data-scrolled-away={scrolledAway} />
      <SectionNav
        domain="example.com"
        sections={Object.values(sections)}
        activeSection="dns"
        isHeaderVisible
        onSectionClick={() => {}}
      />
    </div>
  );
}

function navTranslateY() {
  const nav = document.querySelector("nav[aria-label='Section navigation']");
  return nav ? getComputedStyle(nav).translate : null;
}

describe("SectionNav", () => {
  afterEach(async () => {
    await page.viewport(DESKTOP.width, DESKTOP.height);
  });

  describe("on mobile", () => {
    beforeEach(async () => {
      await page.viewport(MOBILE.width, MOBILE.height);
    });

    it("moves up by the header height while the header is scrolled away", async () => {
      await render(<Harness scrolledAway />);
      await expect.poll(navTranslateY).toBe("0px -72px");
    });

    it("sits below the header while it is visible", async () => {
      await render(<Harness scrolledAway={false} />);
      await expect.poll(navTranslateY).toBe("none");
    });
  });

  it("ignores the header's scroll state on desktop", async () => {
    await render(<Harness scrolledAway />);
    await expect.poll(navTranslateY).toBe("none");
  });

  it("scrolls the active tab into the strip without scrolling the page", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    const scrollSpy = vi.spyOn(window, "scrollTo");
    await render(<Harness scrolledAway={false} />);

    const viewport = document.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]");
    await expect.poll(() => viewport?.scrollLeft ?? 0).toBeGreaterThan(0);
    expect(scrollSpy).not.toHaveBeenCalled();
    scrollSpy.mockRestore();
  });
});
