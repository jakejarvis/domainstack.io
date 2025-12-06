/* @vitest-environment jsdom */
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainSuggestionsClient } from "@/components/domain/domain-suggestions-client";
import { HomeSearchProvider } from "@/components/layout/home-search-context";
import { render, screen } from "@/lib/test-utils";

vi.mock("@/hooks/use-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/domain/favicon", () => ({
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
    <HomeSearchProvider onSuggestionClick={onSuggestionClick || vi.fn()}>
      {ui}
    </HomeSearchProvider>,
  );
}

const DEFAULT_TEST_SUGGESTIONS = [
  "github.com",
  "reddit.com",
  "wikipedia.org",
  "firefox.com",
  "jarv.is",
];

describe("DomainSuggestionsClient", () => {
  beforeEach(() => {
    // Reset history between tests
    localStorage.removeItem("search-history");
  });

  it("renders provided suggestions when there is no history", async () => {
    renderWithProvider(
      <DomainSuggestionsClient defaultSuggestions={DEFAULT_TEST_SUGGESTIONS} />,
    );
    // Wait for a known suggestion like jarv.is to appear
    expect(
      await screen.findByRole("link", { name: /jarv\.is/i }),
    ).toBeInTheDocument();
    // At least one favicon placeholder should exist
    expect(
      document.querySelectorAll('[data-slot="favicon"]').length,
    ).toBeGreaterThan(0);
  });

  it("renders no suggestions when defaultSuggestions is empty and no history", async () => {
    renderWithProvider(<DomainSuggestionsClient defaultSuggestions={[]} />);
    // Container should render but with no buttons
    const buttons = screen.queryAllByRole("link");
    expect(buttons.length).toBe(0);
  });

  it("merges history and suggestions without duplicates, capped by max", async () => {
    localStorage.setItem(
      "search-history",
      JSON.stringify(["foo.com", "github.com", "bar.org"]),
    );
    renderWithProvider(
      <DomainSuggestionsClient
        defaultSuggestions={DEFAULT_TEST_SUGGESTIONS}
        max={4}
      />,
    );
    // History entries appear
    expect(
      await screen.findByRole("link", { name: /foo\.com/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /bar\.org/i })).toBeInTheDocument();
    // github.com appears only once (deduped with suggestions)
    expect(screen.getAllByRole("link", { name: /github\.com/i }).length).toBe(
      1,
    );
  });

  it("shows only history when defaultSuggestions is empty", async () => {
    localStorage.setItem(
      "search-history",
      JSON.stringify(["example.com", "test.org"]),
    );
    renderWithProvider(<DomainSuggestionsClient defaultSuggestions={[]} />);
    // History entries appear
    expect(
      await screen.findByRole("link", { name: /example\.com/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /test\.org/i }),
    ).toBeInTheDocument();
    // Should show 2 history items + 1 clear history button
    expect(screen.getAllByRole("link").length).toBe(2);
    expect(screen.getAllByRole("button").length).toBe(1);
  });

  it("invokes onSelect when a suggestion is clicked", async () => {
    const onSelect = vi.fn();
    localStorage.setItem("search-history", JSON.stringify(["example.com"]));
    renderWithProvider(
      <DomainSuggestionsClient defaultSuggestions={DEFAULT_TEST_SUGGESTIONS} />,
      onSelect,
    );
    await userEvent.click(screen.getByRole("link", { name: /example.com/i }));
    expect(onSelect).toHaveBeenCalledWith("example.com");
  });
});
