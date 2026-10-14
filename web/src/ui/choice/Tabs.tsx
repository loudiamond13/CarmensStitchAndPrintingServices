// Tabs (App. D.3 "Forms", CSPS-UI-SPEC.md §6.3), converted to utilities (D-33) with App. D.3's elements: a
// `role="tablist"` div of `role="tab"` buttons, each its label then an optional count chip. The `.is-on` look keys off
// `aria-selected` (choice.recipe.ts): ink, bold (D-03) and the orange underline; the count chip follows through the
// tab's `group/tab` marker. The strip scrolls sideways inside itself with the scrollbar hidden.
// SPEC-DEVIATION: WEB-02 / A11Y-02 the full WAI-ARIA tabs pattern, with no element added: each tab gets an id and
// `aria-controls` naming its panel (callers render the panel with getTabPanelProps(idBase, id), so the new `idBase`
// prop is required), a roving tabIndex (only the selected tab is in the Tab order), Right/Left move and select with
// wrap, and Home/End jump to the first and last tab (automatic activation). App. D.3 had role and aria-selected only.
import { useRef, useState, type KeyboardEvent } from 'react';
import { tabClasses, tabCountClasses, tabListClasses } from './choice.recipe';
import { rovingItem } from './roving';

export interface TabItem<I extends string = string> {
  id: I;
  label: string;
  /** Shown in the count chip after the label (0 included). */
  count?: number | undefined;
}

export interface TabsProps<I extends string = string> {
  items: readonly TabItem<I>[];
  /** The selected tab; without it the tabs keep their own, starting at the first (App. D.3). */
  value?: I | undefined;
  onChange?: ((id: I) => void) | undefined;
  /** Prefix of every tab and panel id on the page, for example `order`. Pair each panel with getTabPanelProps. */
  idBase: string;
}

/** The ARIA a tab panel needs: its id (the tab's `aria-controls`), the tabpanel role and the tab that names it. */
export interface TabPanelProps {
  readonly id: string;
  readonly role: 'tabpanel';
  readonly 'aria-labelledby': string;
}

function tabId(idBase: string, id: string): string {
  return `${idBase}-tab-${id}`;
}

function panelId(idBase: string, id: string): string {
  return `${idBase}-panel-${id}`;
}

/** Spread onto the element that holds tab `id`'s content: `<div {...getTabPanelProps('order', 'items')}>`. */
export function getTabPanelProps(idBase: string, id: string): TabPanelProps {
  return { id: panelId(idBase, id), role: 'tabpanel', 'aria-labelledby': tabId(idBase, id) };
}

export function Tabs<I extends string = string>({ items, value, onChange, idBase }: TabsProps<I>) {
  const [inner, setInner] = useState<I | undefined>(value ?? items[0]?.id);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = value ?? inner;
  // The tab in the Tab order: the selected one, or the first when none is selected.
  const focusable = items.some((item) => item.id === current) ? current : items[0]?.id;

  const select = (next: I): void => {
    setInner(next);
    onChange?.(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const target = rovingItem(items, index, event.key, 'tabs');
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    select(target.item.id);
    tabs.current[target.index]?.focus();
  };

  return (
    <div className={tabListClasses} role="tablist">
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={(element) => {
            tabs.current[index] = element;
          }}
          role="tab"
          type="button"
          id={tabId(idBase, item.id)}
          aria-selected={current === item.id}
          aria-controls={panelId(idBase, item.id)}
          tabIndex={item.id === focusable ? 0 : -1}
          className={tabClasses}
          onClick={() => {
            select(item.id);
          }}
          onKeyDown={(event) => {
            handleKeyDown(event, index);
          }}
        >
          {item.label}
          {item.count !== undefined && <span className={tabCountClasses}>{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
