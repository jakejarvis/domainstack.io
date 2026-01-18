import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/mocks/react";
import { HomeSearchProvider } from "./home-search-context";
import { HomeSearchSuggestionsClient } from "./home-search-suggestions-client";

vi.mock("@/hooks/use-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/icons/favicon", () => ({
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
    <HomeSearchProvider onSuggestionClick={onSuggestionClick ?? vi.fn()}>
      {ui}
    </HomeSearchProvider>,
  );
}

const DEFAULT_TEST_SUGGESTIONS = [
  "github.invalid",
  "reddit.invalid",
  "wikipedia.invalid",
  "firefox.invalid",
  "jarv.invalid",
];

describe("DomainSuggestionsClient", () => {
  beforeEach(() => {
    // Reset history between tests
    localStorage.removeItem("search-history");
  });

  it("renders provided suggestions when there is no history", async () => {
    renderWithProvider(
      <HomeSearchSuggestionsClient
        defaultSuggestions={DEFAULT_TEST_SUGGESTIONS}
      />,
    );
    // Wait for a known suggestion like jarv.invalid to appear
    expect(
      await screen.findByRole("button", { name: /jarv\.invalid/i }),
    ).toBeInTheDocument();
    // At least one favicon placeholder should exist
    expect(
      document.querySelectorAll('[data-slot="favicon"]').length,
    ).toBeGreaterThan(0);
  });

  it("renders no suggestions when defaultSuggestions is empty and no history", async () => {
    renderWithProvider(<HomeSearchSuggestionsClient defaultSuggestions={[]} />);
    // Container should render but with no buttons
    const buttons = screen.queryAllByRole("button");
    expect(buttons.length).toBe(0);
  });

  it("merges history and suggestions without duplicates, capped by max", async () => {
    localStorage.setItem(
      "search-history",
      JSON.stringify(["foo.invalid", "github.invalid", "bar.invalid"]),
    );
    renderWithProvider(
      <HomeSearchSuggestionsClient
        defaultSuggestions={DEFAULT_TEST_SUGGESTIONS}
        max={4}
      />,
    );
    // History entries appear
    expect(
      await screen.findByRole("button", { name: /foo\.invalid/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /bar\.invalid/i }),
    ).toBeInTheDocument();
    // github.invalid appears only once (deduped with suggestions)
    expect(
      screen.getAllByRole("button", { name: /github\.invalid/i }).length,
    ).toBe(1);
  });

  it("shows only history when defaultSuggestions is empty", async () => {
    localStorage.setItem(
      "search-history",
      JSON.stringify(["example.invalid", "test.invalid"]),
    );
    renderWithProvider(<HomeSearchSuggestionsClient defaultSuggestions={[]} />);
    // History entries appear
    expect(
      await screen.findByRole("button", { name: /example\.invalid/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /test\.invalid/i }),
    ).toBeInTheDocument();
    // Should show 2 history items + 1 clear history button
    expect(screen.getAllByRole("button").length).toBe(3);
    expect(
      screen.getByRole("button", { name: /clear history/i }),
    ).toBeInTheDocument();
  });

  it("clears history when clear button is clicked", async () => {
    localStorage.setItem("search-history", JSON.stringify(["example.invalid"]));
    renderWithProvider(<HomeSearchSuggestionsClient defaultSuggestions={[]} />);

    // Ensure history is loaded and rendered
    expect(
      await screen.findByRole("button", { name: /example\.invalid/i }),
    ).toBeInTheDocument();

    const clearButton = screen.getByRole("button", { name: /clear history/i });
    await userEvent.click(clearButton);

    await waitFor(() => {
      const stored = localStorage.getItem("search-history");
      expect(JSON.parse(stored ?? "[]")).toEqual([]);
      expect(
        screen.queryByRole("button", { name: /example\.invalid/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /clear history/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("invokes onSelect when a suggestion is clicked", async () => {
    const onSelect = vi.fn();
    localStorage.setItem("search-history", JSON.stringify(["example.invalid"]));
    renderWithProvider(
      <HomeSearchSuggestionsClient
        defaultSuggestions={DEFAULT_TEST_SUGGESTIONS}
      />,
      onSelect,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /example.invalid/i }),
    );
    expect(onSelect).toHaveBeenCalledWith("example.invalid");
  });
});
