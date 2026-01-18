"use client";

import { createContext, useContext } from "react";

type HomeSearchContextType = {
  onSuggestionClick: (domain: string) => void;
};

const HomeSearchContext = createContext<HomeSearchContextType | null>(null);

export function HomeSearchProvider({
  children,
  onSuggestionClick,
}: {
  children: React.ReactNode;
  onSuggestionClick: (domain: string) => void;
}) {
  return (
    <HomeSearchContext.Provider value={{ onSuggestionClick }}>
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
