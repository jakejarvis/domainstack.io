"use client";

import { createContext, useContext, useState } from "react";

interface HeaderSearchContextValue {
  isSearchFocused: boolean;
  setIsSearchFocused: React.Dispatch<React.SetStateAction<boolean>>;
}

const HeaderSearchContext = createContext<HeaderSearchContextValue | null>(
  null,
);

export function HeaderSearchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  return (
    <HeaderSearchContext.Provider
      value={{ isSearchFocused, setIsSearchFocused }}
    >
      {children}
    </HeaderSearchContext.Provider>
  );
}

export function useHeaderSearchFocus() {
  const context = useContext(HeaderSearchContext);
  if (!context) {
    throw new Error(
      "useHeaderSearchFocus must be used within HeaderSearchProvider",
    );
  }
  return context;
}
