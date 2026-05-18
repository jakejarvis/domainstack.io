import { usePortfolioStore } from "./stores/portfolio-store";
import { usePushPromptStore } from "./stores/push-prompt-store";
import { useSearchHistoryStore } from "./stores/search-history-store";

/**
 * Clears all user-scoped local state when the active account changes — a
 * sign-out or a direct A→B account switch on a shared device. The persisted
 * tRPC query cache is wiped separately by the caller
 * (`useResetCacheOnSignOut`).
 *
 * Without this, user A's recent searches and portfolio filters leak into
 * user B's session on a shared device.
 *
 * Intentionally NOT reset:
 *  - onboarding (`seen`): device-level, holds no user data; re-showing the
 *    carousel to a returning user is a regression, not a privacy win.
 *  - calendar-sync: owns its own teardown lifecycle in `use-calendar-sync.ts`;
 *    resetting it here would fight that owner and could orphan calendar events.
 */
export function resetUserScopedState(): void {
  usePushPromptStore.getState().reset();
  useSearchHistoryStore.getState().clearHistory();

  const portfolio = usePortfolioStore.getState();
  portfolio.resetFilters();
  portfolio.setQuery("");
  portfolio.exitSelection();
}
