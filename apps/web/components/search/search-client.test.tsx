import userEvent from "@testing-library/user-event";
import { Activity, useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@/mocks/react";

import { SearchClient } from "./search-client";

// Mock base-ui Form to avoid React instance mismatch in browser tests
vi.mock("@/components/ui/form", () => ({
  Form: ({
    children,
    onFormSubmit,
    ...props
  }: React.ComponentProps<"form"> & { onFormSubmit?: () => void }) => (
    <form
      {...props}
      onSubmit={(e) => {
        e.preventDefault();
        onFormSubmit?.();
      }}
    >
      {children}
    </form>
  ),
}));

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

  it("submits valid domain and navigates", async () => {
    let finishNavigation: (() => void) | undefined;
    nav.push.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishNavigation = resolve;
        }),
    );

    render(<SearchClient variant="lg" />);
    const input = screen.getByLabelText(/Search any domain/i);
    await userEvent.type(input, "test.invalid{Enter}");
    expect(nav.push).toHaveBeenCalledWith("/test.invalid");
    // Input and button should be disabled while loading/submitting
    expect((screen.getByLabelText(/Search any domain/i) as HTMLInputElement).disabled).toBe(true);
    // Submit button shows a loading spinner with accessible name "Loading"
    expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();

    finishNavigation?.();
    await waitFor(() => expect(input).toBeEnabled());
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

    render(<PreservedNavigationHarness />);
    const input = screen.getByLabelText(/Search any domain/i);

    await userEvent.type(input, "test.invalid{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Return home" }));

    expect(screen.getByLabelText(/Search any domain/i)).toBeEnabled();
    expect(screen.queryByRole("status", { name: /loading/i })).not.toBeInTheDocument();
  });

  it("shows error toast for invalid domain", async () => {
    const { toast } = (await import("sonner")) as unknown as {
      toast: { error: (msg: string) => void };
    };
    render(<SearchClient variant="lg" />);
    const input = screen.getByLabelText(/Search any domain/i);
    await userEvent.type(input, "not a domain{Enter}");
    expect(toast.error).toHaveBeenCalled();
  });

  it("handles pending domain from store (suggestion click)", async () => {
    // Start with no pending domain
    mockPendingDomain.value = null;
    const { rerender } = render(<SearchClient variant="lg" />);

    // Simulate external navigation request (e.g., from suggestion click via store)
    mockPendingDomain.value = "test.invalid";
    rerender(<SearchClient variant="lg" />);

    // Wait for input to reflect the triggered domain (async due to useEffect)
    const input = (await screen.findByLabelText(/Search any domain/i)) as HTMLInputElement;
    expect(input.value).toBe("test.invalid");

    // Wait for navigation and store clear to be triggered
    await waitFor(() => {
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
    render(<SearchClient variant="sm" />);

    const input = screen.getByLabelText(/Search any domain/i);
    input.blur();
    expect(input).not.toHaveFocus();

    const isMac = /mac/i.test(navigator.userAgent);
    await userEvent.keyboard(isMac ? "{Meta>}k{/Meta}" : "{Control>}k{/Control}");

    expect(input).toHaveFocus();
  });

  it("shows full placeholder on desktop screens", async () => {
    useIsMobile.mockReturnValue(false);

    render(<SearchClient variant="sm" />);

    const input = screen.getByLabelText(/Search any domain/i) as HTMLInputElement;
    expect(input.placeholder).toBe("Search any domain\u2026");
  });

  it("shows short placeholder on mobile screens", async () => {
    useIsMobile.mockReturnValue(true);

    render(<SearchClient variant="sm" />);

    const input = screen.getByLabelText(/Search any domain/i) as HTMLInputElement;
    expect(input.placeholder).toBe("Search\u2026");
  });

  it("updates placeholder when window is resized", async () => {
    // Start with desktop
    useIsMobile.mockReturnValue(false);
    const { rerender } = render(<SearchClient variant="sm" />);

    // Verify desktop placeholder
    let input = screen.getByLabelText(/Search any domain/i) as HTMLInputElement;
    expect(input.placeholder).toBe("Search any domain\u2026");

    // Simulate resize to mobile
    useIsMobile.mockReturnValue(true);
    rerender(<SearchClient variant="sm" />);

    // Verify mobile placeholder
    input = screen.getByLabelText(/Search any domain/i) as HTMLInputElement;
    expect(input.placeholder).toBe("Search\u2026");
  });
});
