// SPEC-GAP: SearchBox (UI-SPEC "SPEC-GAP Primitive Specs" → SearchBox; App. E.7 search column; WEB-06, WEB-08, WEB-10,
// SEC-03, T-02-67). Exactly the App. E.7 look: a 12px `--ink-muted` "Search" label over the 40px `.s-search-box` (the
// 18px search icon and a `type="search"` input, 14px text, 16px on phones by D-01), with the list's placeholder. The
// text is capped at 100 characters (maxLength, the server's limit).
// `onSearch` is the list hook's setSearch: every edit calls it, and it writes the URL after SEARCH_DEBOUNCE_MS (300 ms)
// of quiet (createListParams), so typing "jersey" makes one replace that holds the search and the page reset; Enter
// calls it with `{ immediate: true }`, which writes at once. The list query keys on `useSettledListParams(values, 300)`
// (the search through useDebouncedValue, the page reset held with it), never on the box. The box keeps the text as
// typed (the hook trims what it stores, so the space in "red jersey" survives while typing) and takes a new value from outside (a cleared chip, Back, a
// reset) only when it differs from the typed text once trimmed: the URL stays the one source of the search.
import { useId, useState } from 'react';
import { Icon } from '@/components/brand';
import { LISTS_COPY } from './copy';
import { searchBoxClasses, searchClasses, searchInputClasses, searchLabelClasses } from './lists.recipe';

export interface SearchBoxProps {
  /** The list's search from its list hook (`values.q`; null is no search). */
  value: string | null;
  /** Per list, like "Order no., customer or team". */
  placeholder: string;
  /** The list hook's setSearch: debounced 300 ms, or at once with `{ immediate: true }` (Enter). */
  onSearch: (text: string, options?: { immediate?: boolean }) => void;
  label?: string | undefined;
  id?: string | undefined;
}

export function SearchBox({ value, placeholder, onSearch, label = LISTS_COPY.search, id }: SearchBoxProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const outside = value ?? '';
  const [text, setText] = useState(outside);
  const [seen, setSeen] = useState(outside);
  // Adjust during render (not in an effect) when the URL's search changes from outside.
  if (outside !== seen) {
    setSeen(outside);
    if (text.trim() !== outside.trim()) {
      setText(outside);
    }
  }
  return (
    <div className={searchClasses}>
      <label className={searchLabelClasses} htmlFor={inputId}>
        {label}
      </label>
      <div className={searchBoxClasses}>
        <Icon name="search" size={18} />
        <input
          id={inputId}
          type="search"
          className={searchInputClasses}
          placeholder={placeholder}
          // SEARCH_MAX_LENGTH (url-state/parsers): the server and the URL parser allow 100 UTF-16 code units (SEC-03).
          maxLength={100}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            onSearch(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSearch(text, { immediate: true });
            }
          }}
        />
      </div>
    </div>
  );
}
