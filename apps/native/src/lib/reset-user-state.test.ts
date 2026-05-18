/* @vitest-environment node */
import { beforeEach, describe, expect, it } from "vitest";

import { resetUserScopedState } from "./reset-user-state";
import { usePortfolioStore } from "./stores/portfolio-store";
import { usePushPromptStore } from "./stores/push-prompt-store";
import { useSearchHistoryStore } from "./stores/search-history-store";

// Privacy-sensitive: on sign-out / account switch these stores MUST be cleared
// so user A's searches and filters never leak into user B on a shared device.
describe("resetUserScopedState", () => {
  beforeEach(() => {
    useSearchHistoryStore.getState().clearHistory();
    usePortfolioStore.getState().resetFilters();
    usePortfolioStore.getState().setQuery("");
    usePortfolioStore.getState().exitSelection();
    usePushPromptStore.getState().reset();
  });

  it("clears search history, portfolio filters/query/selection, and push prompt", () => {
    useSearchHistoryStore.getState().addDomain("example.com");
    usePortfolioStore.getState().setQuery("acme");
    usePortfolioStore.getState().toggleHealth("expired");
    usePortfolioStore.getState().toggleTld("com");
    usePortfolioStore.getState().enterSelection("id-1");
    usePushPromptStore.getState().markTriggerHandled("signIn");

    resetUserScopedState();

    expect(useSearchHistoryStore.getState().history).toEqual([]);
    expect(usePortfolioStore.getState().query).toBe("");
    expect(usePortfolioStore.getState().health).toEqual([]);
    expect(usePortfolioStore.getState().tlds).toEqual([]);
    expect(usePortfolioStore.getState().selection.mode).toBe("idle");
    expect(usePortfolioStore.getState().selection.ids.size).toBe(0);
    expect(usePushPromptStore.getState().handledTriggers).toEqual([]);
  });

  it("is idempotent on already-empty state", () => {
    expect(() => {
      resetUserScopedState();
      resetUserScopedState();
    }).not.toThrow();
    expect(useSearchHistoryStore.getState().history).toEqual([]);
  });
});
