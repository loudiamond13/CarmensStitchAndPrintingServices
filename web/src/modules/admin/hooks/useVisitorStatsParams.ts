// RED stub (plan 12-23): the URL hook is built in the GREEN commit.
export function useVisitorStatsParams() {
  return [{ range: '', from: null, to: null }, { setFilters: (patch: unknown) => patch }] as const;
}
