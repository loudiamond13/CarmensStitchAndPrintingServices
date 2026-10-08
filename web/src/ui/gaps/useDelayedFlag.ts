// RED placeholder (plan 13 Task 1): replaced by the implementation in the GREEN commit.
export function useDelayedFlag(flag: boolean, delayMs: number): boolean {
  return flag && delayMs < 0;
}
