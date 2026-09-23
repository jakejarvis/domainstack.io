"use client";

import { createContext, use, useCallback, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { useIsHomeRoute } from "@/hooks/use-is-home-route";

/**
 * Coordinates the collapsible mobile header search between the toggle button (in
 * the header actions) and the search input (in the middle grid column). The refs
 * are part of the contract: `inputRef` so `open()` can focus synchronously
 * inside the tap gesture, `toggleRef` so a dismissal can return focus to it.
 */
type MobileSearchContextValue = {
  isOpen: boolean;
  open: () => void;
  close: (options?: { returnFocus?: boolean }) => void;
  toggleRef: React.RefObject<HTMLButtonElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
};

const MobileSearchContext = createContext<MobileSearchContextValue | null>(null);

export function MobileSearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = useCallback(() => {
    // Commit before focusing: a hidden wrapper can't take focus, and staying in
    // the gesture is what raises the iOS keyboard.
    flushSync(() => setIsOpen(true));
    inputRef.current?.focus();
  }, []);

  const close = useCallback((options?: { returnFocus?: boolean }) => {
    if (options?.returnFocus) {
      // The header actions (holding the toggle) are inert while open, so commit first.
      flushSync(() => setIsOpen(false));
      toggleRef.current?.focus();
      return;
    }
    setIsOpen(false);
  }, []);

  // No toggle renders on the landing page, so an open search surviving
  // navigation there would strand the header actions hidden and inert.
  const isHome = useIsHomeRoute();
  const [wasHome, setWasHome] = useState(isHome);
  if (isHome !== wasHome) {
    setWasHome(isHome);
    if (isHome) setIsOpen(false);
  }

  const value = useMemo(
    () => ({ isOpen, open, close, toggleRef, inputRef }),
    [isOpen, open, close],
  );

  return <MobileSearchContext value={value}>{children}</MobileSearchContext>;
}

export function useMobileSearch(): MobileSearchContextValue {
  const context = use(MobileSearchContext);
  if (!context) {
    throw new Error("useMobileSearch must be used within a MobileSearchProvider");
  }
  return context;
}
