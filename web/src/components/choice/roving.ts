// Arrow-key selection for the choice controls (UI-SPEC Interaction Contract; WAI-ARIA APG radio group and tabs
// patterns). Both use a roving tabIndex: only the selected item is in the Tab order, and the keys below move the
// selection (and the focus) to another item. Arrows wrap at both ends.
//   - radio (SegmentedControl): Right/Down = next, Left/Up = previous.
//   - tabs (Tabs, a horizontal tab list): Right = next, Left = previous, Home = first, End = last.
//   - menu (UserMenu, a vertical menu; WAI-ARIA APG menu button pattern, plan 02-32): Down = next, Up = previous,
//     Home = first, End = last. Menu items have no selection: the keys move focus only.

export type RovingPattern = 'radio' | 'tabs' | 'menu';

function step(key: string, index: number, count: number, pattern: RovingPattern): number | undefined {
  const next = (index + 1) % count;
  const previous = (index - 1 + count) % count;
  switch (key) {
    case 'ArrowRight':
      return pattern === 'menu' ? undefined : next;
    case 'ArrowLeft':
      return pattern === 'menu' ? undefined : previous;
    case 'ArrowDown':
      return pattern === 'tabs' ? undefined : next;
    case 'ArrowUp':
      return pattern === 'tabs' ? undefined : previous;
    case 'Home':
      return pattern === 'radio' ? undefined : 0;
    case 'End':
      return pattern === 'radio' ? undefined : count - 1;
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
