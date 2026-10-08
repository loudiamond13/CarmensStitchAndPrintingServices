// Arrow-key selection for the choice controls (UI-SPEC Interaction Contract; WAI-ARIA APG radio group and tabs
// patterns). Both use a roving tabIndex: only the selected item is in the Tab order, and the keys below move the
// selection (and the focus) to another item. Arrows wrap at both ends.
//   - radio (SegmentedControl): Right/Down = next, Left/Up = previous.
//   - tabs (Tabs, a horizontal tab list): Right = next, Left = previous, Home = first, End = last.

export type RovingPattern = 'radio' | 'tabs';

function step(key: string, index: number, count: number, pattern: RovingPattern): number | undefined {
  const next = (index + 1) % count;
  const previous = (index - 1 + count) % count;
  switch (key) {
    case 'ArrowRight':
      return next;
    case 'ArrowLeft':
      return previous;
    case 'ArrowDown':
      return pattern === 'radio' ? next : undefined;
    case 'ArrowUp':
      return pattern === 'radio' ? previous : undefined;
    case 'Home':
      return pattern === 'tabs' ? 0 : undefined;
    case 'End':
      return pattern === 'tabs' ? count - 1 : undefined;
    default:
      return undefined;
  }
}

/** The item `key` moves the selection to from `index`, or undefined when the pattern does not handle the key. */
export function rovingItem<T>(
  items: readonly T[],
  index: number,
  key: string,
  pattern: RovingPattern,
): { readonly item: T; readonly index: number } | undefined {
  const target = step(key, index, items.length, pattern);
  if (target === undefined) {
    return undefined;
  }
  const item = items[target];
  return item === undefined ? undefined : { item, index: target };
}
