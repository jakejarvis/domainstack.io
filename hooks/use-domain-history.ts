import { useEffect } from "react";

export function useDomainHistory(domain: string) {
  useEffect(() => {
    if (!domain) return;

    try {
      const stored = localStorage.getItem("search-history");
      const list = stored ? (JSON.parse(stored) as string[]) : [];
      const next = [domain, ...list.filter((d) => d !== domain)].slice(0, 5);
      localStorage.setItem("search-history", JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }, [domain]);
}
