import { vi } from "vitest";

export const routerSpies = {
  push: vi.fn<(href: string, options?: { scroll?: boolean }) => void>(),
};

export function useRouter() {
  return { push: routerSpies.push };
}
