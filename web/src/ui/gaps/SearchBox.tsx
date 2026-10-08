// SPEC-GAP: SearchBox (02-UI-SPEC SPEC-GAP "SearchBox"; App. E.7; WEB-06, WEB-10, T-02-36). Exactly the App. E.7
// markup: a 12px muted "Search" label over .s-search-box (search icon 18, input type="search", maxLength 100). Every
// edit goes to onChange (the list hook's debounced setSearch); Enter goes to onSubmit (setSearch with immediate).
//
// The box keeps the text as typed. The list hook trims the search it stores, so a box bound straight to it would eat
// the space in "red jersey" as it is typed. The box takes a new value from outside (a cleared chip, Back, a reset)
// only when it differs from the typed text once trimmed; the URL stays the one source of the search.
import { useId, useState } from 'react';
import { Icon } from '@/ui';
import { FILTER_BAR_COPY } from './copy';
import { SEARCH_MAX_LENGTH } from '@/lib/url-state/parsers';

export interface SearchBoxProps {
  /** The list's search, from its list hook (null shown as ''). */
  value: string;
  /** Per list, like "Order no., customer or team". */
  placeholder: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  label?: string;
  id?: string;
}

export function SearchBox({
  value,
  placeholder,
  onChange,
  onSubmit,
  label = FILTER_BAR_COPY.search,
  id,
}: SearchBoxProps) {
  const fid = useId();
  const inputId = id ?? fid;
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (text.trim() !== value.trim()) {
      setText(value);
    }
  }
  return (
    <div className="s-search" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 260px' }}>
      <label
        className="csp-label"
        htmlFor={inputId}
        style={{ fontSize: 12, lineHeight: '16px', color: 'var(--ink-muted)' }}
      >
        {label}
      </label>
      <div className="s-search-box">
        <Icon name="search" size={18} />
        <input
          id={inputId}
          type="search"
          placeholder={placeholder}
          maxLength={SEARCH_MAX_LENGTH}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            onChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onSubmit(text);
            }
          }}
        />
      </div>
    </div>
  );
}
