import { QueryClient } from "@tanstack/react-query";

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60 * 24, // 24 hours — Siddur text rarely changes
      // NOTE: TanStack Query v5 renamed `cacheTime` -> `gcTime`. The old name
      // is silently ignored by v5, so this was a no-op and every query fell
      // back to the default 5-minute gcTime — meaning cached Siddur/zmanim
      // data was evicted from memory 5 min after its last observer unmounted
      // (e.g. navigating away and back), forcing an avoidable refetch despite
      // staleTime saying the data was still good for 24h.
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
