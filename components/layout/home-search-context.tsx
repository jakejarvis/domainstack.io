"use client";

import { createContext, useContext } from "react";

type HomeSearchContextType = {
  onSuggestionClickAction: (domain: string) => void;
};

const HomeSearchContext = createContext<HomeSearchContextType | null>(null);

export function HomeSearchProvider({
  children,
  onSuggestionClickAction,
}: {
  children: React.ReactNode;
  onSuggestionClickAction: (domain: string) => void;
}) {
  return (
    <HomeSearchContext.Provider value={{ onSuggestionClickAction }}>
      {children}
    </HomeSearchContext.Provider>
  );
}

export function useHomeSearch() {
  const context = useContext(HomeSearchContext);
  if (!context) {
    throw new Error("useHomeSearch must be used within HomeSearchProvider");
  }
  return context;
}
