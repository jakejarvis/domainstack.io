/* @vitest-environment jsdom */
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainSearch } from "@/components/domain/domain-search";
import { render, screen, waitFor } from "@/lib/test-utils";

const nav = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("@/hooks/use-router", () => ({
  useRouter: () => ({ push: nav.push }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

describe("DomainSearch (form variant)", () => {
  beforeEach(() => {
    nav.push.mockClear();
  });

  it("submits valid domain and navigates", async () => {
    render(<DomainSearch variant="lg" />);
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
    render(<DomainSearch variant="lg" />);
    const input = screen.getByLabelText(/Search any domain/i);
    await userEvent.type(input, "not a domain{Enter}");
    expect(toast.error).toHaveBeenCalled();
  });

  it("handles external navigation trigger", async () => {
    const onComplete = vi.fn();
    const { rerender } = render(
      <DomainSearch variant="lg" onNavigationCompleteAction={onComplete} />,
    );

    // Simulate external navigation request (e.g., from suggestion click)
    rerender(
      <DomainSearch
        variant="lg"
        externalNavigation={{ domain: "example.com", source: "suggestion" }}
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
