import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 60 * 24,
        retry: false,
        staleTime: 1000 * 60,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
