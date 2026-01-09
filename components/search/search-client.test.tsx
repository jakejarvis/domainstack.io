import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/mocks/react";
import { SearchClient } from "./search-client";

const nav = vi.hoisted(() => ({
  push: vi.fn(),
}));

const useIsMobile = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/hooks/use-router", () => ({
  useRouter: () => ({ push: nav.push }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

describe("DomainSearch (form variant)", () => {
  beforeEach(() => {
    nav.push.mockClear();
    useIsMobile.mockReturnValue(false);
  });

  it("submits valid domain and navigates", async () => {
    render(<SearchClient variant="lg" />);
    const input = screen.getByLabelText(/Search any domain/i);
    await userEvent.type(input, "example.com{Enter}");
    expect(nav.push).toHaveBeenCalledWith("/example.com");
    // Input and button should be disabled while loading/submitting
    expect(
      (screen.getByLabelText(/Search any domain/i) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    // Submit button shows a loading spinner with accessible name "Loading"
    expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();
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

  it("handles external navigation trigger", async () => {
    const onComplete = vi.fn();
    const { rerender } = render(
      <SearchClient variant="lg" onNavigationCompleteAction={onComplete} />,
    );

    // Simulate external navigation request (e.g., from suggestion click)
    rerender(
      <SearchClient
        variant="lg"
        value="example.com"
        onNavigationCompleteAction={onComplete}
      />,
    );

    // Wait for input to reflect the triggered domain (async due to useEffect)
    const input = (await screen.findByLabelText(
      /Search any domain/i,
    )) as HTMLInputElement;
    expect(input.value).toBe("example.com");

    // Wait for navigation and completion callback to be triggered
    await waitFor(() => {
      expect(nav.push).toHaveBeenCalledWith("/example.com");
      expect(onComplete).toHaveBeenCalled();
    });
  });
});

describe("DomainSearch (header variant)", () => {
  beforeEach(() => {
    nav.push.mockClear();
    useIsMobile.mockReturnValue(false);
  });

  it("shows full placeholder on desktop screens", async () => {
    useIsMobile.mockReturnValue(false);

    render(<SearchClient variant="sm" />);

    const input = screen.getByLabelText(
      /Search any domain/i,
    ) as HTMLInputElement;
    expect(input.placeholder).toBe("Search any domain");
  });

  it("shows short placeholder on mobile screens", async () => {
    useIsMobile.mockReturnValue(true);

    render(<SearchClient variant="sm" />);

    const input = screen.getByLabelText(
      /Search any domain/i,
    ) as HTMLInputElement;
    expect(input.placeholder).toBe("Search");
  });

  it("updates placeholder when window is resized", async () => {
    // Start with desktop
    useIsMobile.mockReturnValue(false);
    const { rerender } = render(<SearchClient variant="sm" />);

    // Verify desktop placeholder
    let input = screen.getByLabelText(/Search any domain/i) as HTMLInputElement;
    expect(input.placeholder).toBe("Search any domain");

    // Simulate resize to mobile
    useIsMobile.mockReturnValue(true);
    rerender(<SearchClient variant="sm" />);

    // Verify mobile placeholder
    input = screen.getByLabelText(/Search any domain/i) as HTMLInputElement;
    expect(input.placeholder).toBe("Search");
  });
});
