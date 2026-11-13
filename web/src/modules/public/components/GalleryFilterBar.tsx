// GalleryFilterBar (UI-SPEC G1 item 2, GAL-01, D-03, D-32): the sticky toolbar "Filter by category" with "All {16}" first and
// one 44px pill per shown line, each "{short} {count}" with a hidden " items". The selected pill is maroon with
// aria-pressed. A key that fails the allow-list gets no pill (T-11-74), and with no pill at all there is no bar.
import clsx from 'clsx';
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
  onClick: () => void;
}

function Pill({ label, count, on, onClick }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={clsx(galleryPillClasses, on ? galleryPillOnClasses : galleryPillOffClasses)}
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
  const shown = pills.filter((pill) => isLineKey(pill.key));
  if (shown.length === 0) {
    return null;
  }
  return (
    <div className={anchorsClasses} data-gallery-bar="">
      <div role="toolbar" aria-label={COPY.filterBar} className={anchorsInClasses}>
        <Pill
          label={COPY.all}
          count={total}
          on={selected === null}
          onClick={() => {
            onSelect(null);
          }}
        />
        {shown.map((pill) => (
          <Pill
            key={pill.key}
            label={pill.shortName}
            count={Number(pill.count)}
            on={selected === pill.key}
            onClick={() => {
              onSelect(pill.key);
            }}
          />
        ))}
      </div>
    </div>
  );
}
