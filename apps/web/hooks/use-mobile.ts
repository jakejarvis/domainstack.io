import { useMediaQuery } from "@domainstack/ui/hooks";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}
