// The server's business today (D-59). Skeleton for the red step: the real hook replaces it.
export function useBusinessTodayState(enabled = true): {
  today: string | null;
  isError: boolean;
  refetch: () => void;
} {
  void enabled;
  return { today: null, isError: false, refetch: () => undefined };
}

export function useBusinessToday(enabled = true): string | null {
  return useBusinessTodayState(enabled).today;
}
