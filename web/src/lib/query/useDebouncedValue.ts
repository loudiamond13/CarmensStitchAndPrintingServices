// RED placeholder (02-08 Task 3): no debounce; replaced in GREEN.
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  return delayMs < 0 ? value : value;
}
