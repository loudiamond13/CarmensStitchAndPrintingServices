// GalleryFilterBar (UI-SPEC G1 item 2, GAL-01, D-03, D-32): the sticky toolbar "Filter by category" with "All {16}" first and
// one 44px pill per shown line, each "{short} {count}" with a hidden " items". The selected pill is maroon with
// aria-pressed. A key that fails the allow-list gets no pill (T-11-74), and with no pill at all there is no bar.
// Roving focus (the toolbar pattern): one tab stop, Left and Right move the focus with wrap, Home and End jump, Enter or Space
// selects. Selecting keeps the focus on the pill and says "Showing {4} items" in a polite region.
import clsx from 'clsx';
import { useRef, useState, type KeyboardEvent } from 'react';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { PUBLIC_COPY } from '../copy';
import { isLineKey } from '../lineKey';
import type { PublicGalleryPill } from '../services/contentService';
import {
  galleryPillClasses,
  galleryPillCountClasses,
  galleryPillOffClasses,
  galleryPillOnClasses,
} from './gallery.recipe';
import { anchorsClasses, anchorsInClasses } from './products.recipe';

const { gallery: COPY } = PUBLIC_COPY;

const MOVE_KEYS: readonly string[] = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];

export interface GalleryFilterBarProps {
  pills: readonly PublicGalleryPill[];
  /** The count on the All pill. */
  total: number;
  /** The selected line key, or null for All. */
  selected: string | null;
  /** The chosen line key, or null for All. */
  onSelect: (key: string | null) => void;
}

interface PillProps {
  label: string;
  count: number;
  on: boolean;
  tabStop: boolean;
  onFocus: () => void;
  onClick: () => void;
}

function Pill({ label, count, on, tabStop, onFocus, onClick }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      tabIndex={tabStop ? 0 : -1}
      className={clsx(galleryPillClasses, on ? galleryPillOnClasses : galleryPillOffClasses)}
      onFocus={onFocus}
      onClick={onClick}
    >
      {label}{' '}
      <span className={galleryPillCountClasses}>
        {count} <span className={srOnlyClasses}>{COPY.itemsHidden}</span>
      </span>
    </button>
  );
}

export function GalleryFilterBar({ pills, total, selected, onSelect }: GalleryFilterBarProps) {
  const bar = useRef<HTMLDivElement>(null);
  // The pill the one tab stop is on: the last one focused, else the selected one.
  const [focused, setFocused] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const shown = pills.filter((pill) => isLineKey(pill.key));
  if (shown.length === 0) {
    return null;
  }
  const selectedIndex = Math.max(0, shown.findIndex((pill) => pill.key === selected) + 1);
  const last = shown.length;
  const tabStop = Math.min(focused ?? selectedIndex, last);

  function choose(key: string | null, count: number): void {
    setMessage(COPY.showing(count));
    onSelect(key);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (!MOVE_KEYS.includes(event.key)) {
      return;
    }
    const buttons = Array.from(bar.current?.querySelectorAll('button') ?? []);
    const from = buttons.findIndex((button) => button === event.target);
    if (from === -1) {
      return;
    }
    event.preventDefault();
    const to =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? last
          : event.key === 'ArrowRight'
            ? (from + 1) % (last + 1)
            : (from + last) % (last + 1);
    buttons[to]?.focus();
  }

  return (
    <div className={anchorsClasses} data-gallery-bar="">
      <div ref={bar} role="toolbar" aria-label={COPY.filterBar} className={anchorsInClasses} onKeyDown={onKeyDown}>
        <Pill
          label={COPY.all}
          count={total}
          on={selected === null}
          tabStop={tabStop === 0}
          onFocus={() => {
            setFocused(0);
          }}
          onClick={() => {
            choose(null, total);
          }}
        />
        {shown.map((pill, index) => (
          <Pill
            key={pill.key}
            label={pill.shortName}
            count={Number(pill.count)}
            on={selected === pill.key}
            tabStop={tabStop === index + 1}
            onFocus={() => {
              setFocused(index + 1);
            }}
            onClick={() => {
              choose(pill.key, Number(pill.count));
            }}
          />
        ))}
      </div>
      <div role="status" aria-live="polite" className={srOnlyClasses}>
        {message}
      </div>
    </div>
  );
}
