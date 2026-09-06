import { Activity, useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { render } from "@/mocks/react";

import { SearchClient } from "./search-client";

const nav = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void | Promise<void>>(),
}));
const TEST_NAVIGATE_EVENT = "search-test-navigate";

const useIsMobile = vi.hoisted(() => vi.fn<() => boolean>(() => false));

// Mock pending domain atom state
const mockPendingDomain = vi.hoisted(() => ({
  value: null as string | null,
}));
const mockSetPendingDomain = vi.fn<(domain: string | null) => void>();

vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return {
    ...actual,
    useAtom: () => [mockPendingDomain.value, mockSetPendingDomain],
  };
});

vi.mock("@/hooks/use-router", () => ({
  useRouter: () => ({ push: nav.push }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn<(message?: string) => void>() } }));

function domainSearchInput() {
  return page.getByRole("textbox", { name: "Domain" });
}

describe("DomainSearch (form variant)", () => {
  beforeEach(() => {
    nav.push.mockClear();
    nav.push.mockImplementation(() => {
      window.dispatchEvent(new Event(TEST_NAVIGATE_EVENT));
    });
    mockSetPendingDomain.mockClear();
    mockPendingDomain.value = null;
    useIsMobile.mockReturnValue(false);
  });

  it("exposes WebMCP tool attributes for domain search", async () => {
    await render(<SearchClient variant="lg" />);

    const form = page.getByRole("form", { name: "Domain search" });
    await expect.element(form).toHaveAttribute("tool-name", "domain-search");
    await expect
      .element(form)
      .toHaveAttribute(
        "tool-description",
        "Look up WHOIS, DNS, SSL, hosting, HTTP headers, and SEO for any domain",
      );
    await expect.element(form).toHaveAttribute("action", "/");
    await expect.element(form).toHaveAttribute("method", "GET");
    await expect.element(domainSearchInput()).toHaveAttribute("name", "q");
  });

  it("submits valid domain and navigates", async () => {
    let finishNavigation: (() => void) | undefined;
    nav.push.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishNavigation = resolve;
        }),
    );

    await render(<SearchClient variant="lg" />);
    const input = domainSearchInput();
    await userEvent.type(input, "test.invalid{Enter}");
    expect(nav.push).toHaveBeenCalledWith("/test.invalid");
    // Input and button should be disabled while loading/submitting
    await expect.element(domainSearchInput()).toBeDisabled();
    // Submit button shows a loading spinner that replaces the submit icon
    const submitButton = page.getByRole("button", { name: /loading/i });
    await expect.element(submitButton).toBeDisabled();
    expect(submitButton.element().querySelectorAll("svg")).toHaveLength(1);

    finishNavigation?.();
    await expect.element(input).toBeEnabled();
  });

  it("clears the loading state when a preserved homepage is restored", async () => {
    function PreservedNavigationHarness() {
      const [route, setRoute] = useState<"home" | "report">("home");
      useEffect(() => {
        const showReport = () => setRoute("report");
        window.addEventListener(TEST_NAVIGATE_EVENT, showReport);
        return () => window.removeEventListener(TEST_NAVIGATE_EVENT, showReport);
      }, []);

      return (
        <>
          <Activity mode={route === "home" ? "visible" : "hidden"}>
            <SearchClient variant="lg" />
          </Activity>
          {route === "report" && (
            <button type="button" onClick={() => setRoute("home")}>
              Return home
            </button>
          )}
        </>
      );
    }

    await render(<PreservedNavigationHarness />);
    const input = domainSearchInput();

    await userEvent.type(input, "test.invalid{Enter}");
    await page.getByRole("button", { name: "Return home" }).click();

    await expect.element(domainSearchInput()).toBeEnabled();
    await expect.element(page.getByRole("status", { name: /loading/i })).not.toBeInTheDocument();
  });

  it("shows error toast for invalid domain", async () => {
    const { toast } = (await import("sonner")) as unknown as {
      toast: { error: (msg: string) => void };
    };
    await render(<SearchClient variant="lg" />);
    const input = domainSearchInput();
    await userEvent.type(input, "not a domain{Enter}");
    expect(toast.error).toHaveBeenCalled();
  });

  it("handles pending domain from store (suggestion click)", async () => {
    // Start with no pending domain
    mockPendingDomain.value = null;
    const { rerender } = await render(<SearchClient variant="lg" />);

    // Simulate external navigation request (e.g., from suggestion click via store)
    mockPendingDomain.value = "test.invalid";
    await rerender(<SearchClient variant="lg" />);

    // Wait for input to reflect the triggered domain (async due to useEffect)
    const input = domainSearchInput();
    await expect.element(input).toHaveValue("test.invalid");

    // Wait for navigation and store clear to be triggered
    await vi.waitFor(() => {
      expect(nav.push).toHaveBeenCalledWith("/test.invalid");
      expect(mockSetPendingDomain).toHaveBeenCalledWith(null);
    });
  });
});

describe("DomainSearch (header variant)", () => {
  beforeEach(() => {
    nav.push.mockClear();
    useIsMobile.mockReturnValue(false);
  });

  it("focuses the input on Mod+K", async () => {
    await render(<SearchClient variant="sm" />);

    const input = domainSearchInput();
    input.element().blur();
    expect(document.activeElement).not.toBe(input.element());

    const isMac = /mac/i.test(navigator.userAgent);
    await userEvent.keyboard(isMac ? "{Meta>}k{/Meta}" : "{Control>}k{/Control}");

    expect(document.activeElement).toBe(input.element());
  });

  it("shows full placeholder on desktop screens", async () => {
    useIsMobile.mockReturnValue(false);

    await render(<SearchClient variant="sm" />);

    const input = domainSearchInput();
    await expect.element(input).toHaveAttribute("placeholder", "Search any domain\u2026");
  });

  it("shows short placeholder on mobile screens", async () => {
    useIsMobile.mockReturnValue(true);

    await render(<SearchClient variant="sm" />);

    const input = domainSearchInput();
    await expect.element(input).toHaveAttribute("placeholder", "Search\u2026");
  });

  it("updates placeholder when window is resized", async () => {
    // Start with desktop
    useIsMobile.mockReturnValue(false);
    const { rerender } = await render(<SearchClient variant="sm" />);

    // Verify desktop placeholder
    let input = domainSearchInput();
    await expect.element(input).toHaveAttribute("placeholder", "Search any domain\u2026");

    // Simulate resize to mobile
    useIsMobile.mockReturnValue(true);
    await rerender(<SearchClient variant="sm" />);

    // Verify mobile placeholder
    input = domainSearchInput();
    await expect.element(input).toHaveAttribute("placeholder", "Search\u2026");
  });
});
