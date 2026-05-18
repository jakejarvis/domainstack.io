/**
 * Builds a zustand `onRehydrateStorage` callback that flips a `hasHydrated`
 * flag once rehydration settles — on SUCCESS or FAILURE.
 *
 * zustand invokes the post-rehydration callback even when the AsyncStorage
 * read throws or the persisted JSON is corrupt. Consumers that gate UI on
 * `hasHydrated` (the root index route, the push soft-prompt) would otherwise
 * hang in a permanent loading/suppressed state on a bad blob. We deliberately
 * ignore the `state`/`error` arguments and always flip the flag: a corrupt
 * blob just means the in-memory defaults apply for this launch.
 *
 * Centralized so every persisted store handles this identically instead of
 * copy-pasting `() => () => setState({ hasHydrated: true })` — and so the
 * always-flip-even-on-error guarantee is explicit rather than incidental. The
 * returned listener is intentionally parameter-less so it stays assignable for
 * every store without widening zustand's state-type inference.
 */
export function onHydrated(markHydrated: () => void) {
  return (): (() => void) => {
    return () => {
      markHydrated();
    };
  };
}
