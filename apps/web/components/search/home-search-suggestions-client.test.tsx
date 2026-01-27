import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/mocks/react";
import { HomeSearchSuggestionsClient } from "./home-search-suggestions-client";

vi.mock("@/components/icons/favicon", () => ({
  Favicon: ({ domain }: { domain: string }) =>
    createElement("span", {
      "data-slot": "favicon",
      "data-domain": domain,
    }),
}));

// Mock the search history store to control history state in tests
const mockClearHistory = vi.fn();
const mockHistoryState = vi.hoisted(() => ({
  history: [] as string[],
}));

vi.mock("@/lib/stores/search-history-store", () => ({
  useSearchHistoryStore: (
    selector: (state: {
      history: string[];
      clearHistory: () => void;
    }) => unknown,
  ) =>
    selector({
      history: mockHistoryState.history,
      clearHistory: mockClearHistory,
    }),
}));

// Mock the home search store
const mockSetPendingDomain = vi.fn();

vi.mock("@/lib/stores/home-search-store", () => ({
  useHomeSearchStore: (
    selector: (state: {
      pendingDomain: string | null;
      setPendingDomain: (domain: string | null) => void;
    }) => unknown,
  ) =>
    selector({
      pendingDomain: null,
      setPendingDomain: mockSetPendingDomain,
    }),
}));

const DEFAULT_TEST_SUGGESTIONS = [
  "github.invalid",
  "reddit.invalid",
  "wikipedia.invalid",
  "firefox.invalid",
  "jarv.invalid",
];

describe("DomainSuggestionsClient", () => {
  beforeEach(() => {
    // Reset mock history between tests
    mockHistoryState.history = [];
    mockClearHistory.mockClear();
    mockSetPendingDomain.mockClear();
  });

  it("renders provided suggestions when there is no history", async () => {
    render(
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
    render(<HomeSearchSuggestionsClient defaultSuggestions={[]} />);
    // Container should render but with no buttons
    const buttons = screen.queryAllByRole("button");
    expect(buttons.length).toBe(0);
  });

  it("merges history and suggestions without duplicates, capped by max", async () => {
    mockHistoryState.history = ["foo.invalid", "github.invalid", "bar.invalid"];
    render(
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
    mockHistoryState.history = ["example.invalid", "test.invalid"];
    render(<HomeSearchSuggestionsClient defaultSuggestions={[]} />);
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
    mockHistoryState.history = ["example.invalid"];
    render(<HomeSearchSuggestionsClient defaultSuggestions={[]} />);

    // Ensure history is loaded and rendered
    expect(
      await screen.findByRole("button", { name: /example\.invalid/i }),
    ).toBeInTheDocument();

    const clearButton = screen.getByRole("button", { name: /clear history/i });
    await userEvent.click(clearButton);

    // Verify clearHistory was called
    expect(mockClearHistory).toHaveBeenCalled();
  });

  it("sets pending domain when a suggestion is clicked", async () => {
    mockHistoryState.history = ["example.invalid"];
    render(
      <HomeSearchSuggestionsClient
        defaultSuggestions={DEFAULT_TEST_SUGGESTIONS}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /example.invalid/i }),
    );
    expect(mockSetPendingDomain).toHaveBeenCalledWith("example.invalid");
  });
});
