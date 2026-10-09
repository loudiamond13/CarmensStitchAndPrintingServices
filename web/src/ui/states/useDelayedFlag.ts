// SPEC-GAP: the 200 ms refetch delay (RED stub, plan 02-28 Task 2).
export function useDelayedFlag(flag: boolean, delayMs: number): boolean {
  return flag && delayMs < 0;
}
