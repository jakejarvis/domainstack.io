"use client";

import { createContext, use, useCallback, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { useIsHomeRoute } from "@/hooks/use-is-home-route";

/**
 * Coordinates the collapsible mobile header search between the toggle button
 * (which lives in the right-hand icon cluster) and the search input (which lives
 * in the middle grid column).
 *
 * Refs are part of the contract on purpose:
 * - `inputRef` lets `open()` focus the input *synchronously* inside the tap
 *   handler, which is what makes iOS Safari raise the keyboard. Focusing from an
 *   effect after the state flush is not reliably inside the gesture.
 * - `toggleRef` lets an explicit dismissal (Escape, close button) return focus to
 *   the control that opened the search, per the APG disclosure pattern.
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
    // flushSync so the collapsed wrapper is visible before we focus — focus is
    // blocked while it is `visibility: hidden`. Staying synchronous keeps the
    // focus call inside the user gesture, which is what raises the iOS keyboard.
    flushSync(() => setIsOpen(true));
    inputRef.current?.focus();
  }, []);

  const close = useCallback((options?: { returnFocus?: boolean }) => {
    if (options?.returnFocus) {
      // The icon cluster holding the toggle is inert while the search is open, so
      // the collapse has to commit before focus can land back on it.
      flushSync(() => setIsOpen(false));
      toggleRef.current?.focus();
      return;
    }
    setIsOpen(false);
  }, []);

  // The toggle is not rendered on the landing page, so an open search that
  // survives navigation there would leave the action cluster hidden and inert
  // with no control left to reopen it. Adjust during render rather than in an
  // effect, the same way `useSearchClient` reacts to a new route prefill.
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
