import { useCallback, useEffect, useState } from "react";
import useLocalStorageState from "use-local-storage-state";
import { MAX_HISTORY_ITEMS } from "@/lib/constants/app";

const STORAGE_KEY = "search-history";

interface UseDomainHistoryOptions {
  /**
   * Whether to add the domain to history. When false, the hook only returns
   * the current history without modifying it. Useful when you can't
   * conditionally call the hook.
   *
   * @default true
   */
  enabled?: boolean;
}

/**
 * Hook for managing domain search history in localStorage.
 *
 * @param domain - Optional domain to add to history. When provided and enabled=true,
 *                 the domain is added to the front of the list, deduplicating if it already exists.
 * @param options - Configuration options
 *
 * @returns Object containing:
 * - `history`: Array of domain strings in order (most recent first)
 * - `isHistoryLoaded`: Boolean indicating if history has been loaded from localStorage
 * - `clearHistory`: Function to clear all history from localStorage and state
 *
 * @example
 * ```tsx
 * // Load and display history
 * const { history, isHistoryLoaded } = useDomainHistory();
 * if (isHistoryLoaded) {
 *   return <ul>{history.map(d => <li key={d}>{d}</li>)}</ul>;
 * }
 *
 * // Add a domain to history
 * const { history } = useDomainHistory("example.com");
 *
 * // Conditionally add to history
 * const { history } = useDomainHistory(domain, { enabled: isRegistered });
 *
 * // Clear history
 * const { clearHistory } = useDomainHistory();
 * <button onClick={clearHistory}>Clear</button>
 * ```
 */
export function useDomainHistory(
  domain?: string,
  options: UseDomainHistoryOptions = {},
) {
  const { enabled = true } = options;

  const [history, setHistory, { removeItem, isPersistent }] =
    useLocalStorageState<string[]>(STORAGE_KEY, {
      defaultValue: [],
      // This ensures the server matches the initial client render (which defaults to [])
      // before the effect runs to load the actual data from localStorage.
      defaultServerValue: [],
    });
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

  // Mark history as loaded on mount
  useEffect(() => {
    setIsHistoryLoaded(true);
  }, []);

  // Add domain to history when provided and enabled
  useEffect(() => {
    // Only update if we have a domain, it's enabled, and storage is synchronized/persistent
    // This prevents overwriting storage with a partial list if not yet loaded
    if (!domain || !enabled || !isPersistent) return;

    // Use functional setState to avoid race conditions and ensure we work with latest state
    setHistory((currentHistory) => {
      // Skip update if domain is already at the front
      if (currentHistory.length > 0 && currentHistory[0] === domain) {
        return currentHistory;
      }

      // Create new list with domain at front, removing any duplicates
      return [domain, ...currentHistory.filter((d) => d !== domain)].slice(
        0,
        MAX_HISTORY_ITEMS,
      );
    });
  }, [domain, enabled, isPersistent, setHistory]);

  // Clear history function
  const clearHistory = useCallback(() => {
    removeItem();
  }, [removeItem]);

  return {
    history,
    isHistoryLoaded,
    clearHistory,
  };
}
