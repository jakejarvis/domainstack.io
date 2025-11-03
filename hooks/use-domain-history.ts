import { useCallback, useEffect, useState } from "react";
import { MAX_HISTORY_ITEMS } from "@/lib/constants";

const STORAGE_KEY = "search-history";

/**
 * Hook for managing domain search history in localStorage.
 *
 * @param domain - Optional domain to add to history. When provided, the domain
 *                 is added to the front of the list, deduplicating if it already exists.
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
 * // Clear history
 * const { clearHistory } = useDomainHistory();
 * <button onClick={clearHistory}>Clear</button>
 * ```
 */
export function useDomainHistory(domain?: string) {
  const [history, setHistory] = useState<string[]>([]);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        setHistory(parsed);
      }
    } catch {
      // ignore parse errors
    } finally {
      setIsHistoryLoaded(true);
    }
  }, []);

  // Add domain to history when provided
  useEffect(() => {
    if (!domain || !isHistoryLoaded) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const list = stored ? (JSON.parse(stored) as string[]) : [];
      const next = [domain, ...list.filter((d) => d !== domain)].slice(
        0,
        MAX_HISTORY_ITEMS,
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setHistory(next);
    } catch {
      // ignore storage errors
    }
  }, [domain, isHistoryLoaded]);

  // Clear history function
  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setHistory([]);
    } catch {
      // ignore storage errors
    }
  }, []);

  return {
    history,
    isHistoryLoaded,
    clearHistory,
  };
}
