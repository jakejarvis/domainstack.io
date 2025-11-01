/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainSuggestions } from "@/components/domain/domain-suggestions";
import { HomeSearchProvider } from "@/components/home-search-context";

vi.mock("@/hooks/use-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/favicon", () => ({
  Favicon: ({ domain }: { domain: string }) =>
    createElement("span", {
      "data-slot": "favicon",
      "data-domain": domain,
    }),
}));

// Helper to render with provider
function renderWithProvider(
  ui: React.ReactElement,
  onSuggestionClick?: (domain: string) => void,
) {
  return render(
    <HomeSearchProvider onSuggestionClickAction={onSuggestionClick || vi.fn()}>
      {ui}
    </HomeSearchProvider>,
  );
}

describe("DomainSuggestions", () => {
  beforeEach(() => {
    // Reset history between tests
    localStorage.removeItem("search-history");
  });

  it("renders provided suggestions when there is no history", async () => {
    renderWithProvider(<DomainSuggestions />);
    // Wait for a known suggestion like jarv.is to appear
    expect(
      await screen.findByRole("button", { name: /jarv\.is/i }),
    ).toBeInTheDocument();
    // At least one favicon placeholder should exist
    expect(
      document.querySelectorAll('[data-slot="favicon"]').length,
    ).toBeGreaterThan(0);
  });

  it("merges history and suggestions without duplicates, capped by max", async () => {
    localStorage.setItem(
      "search-history",
      JSON.stringify(["foo.com", "github.com", "bar.org"]),
    );
    renderWithProvider(<DomainSuggestions max={4} />);
    // History entries appear
    expect(
      await screen.findByRole("button", { name: /foo\.com/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /bar\.org/i }),
    ).toBeInTheDocument();
    // github.com appears only once (deduped with suggestions)
    expect(screen.getAllByRole("button", { name: /github\.com/i }).length).toBe(
      1,
    );
  });

  it("invokes onSelect when a suggestion is clicked", async () => {
    const onSelect = vi.fn();
    localStorage.setItem("search-history", JSON.stringify(["example.com"]));
    renderWithProvider(<DomainSuggestions />, onSelect);
    await userEvent.click(screen.getByRole("button", { name: /example.com/i }));
    expect(onSelect).toHaveBeenCalledWith("example.com");
  });
});
