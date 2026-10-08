// The media placeholder (CSPS-UI-SPEC.md §5, App. D.3 MediaPlaceholder, App. B `/* ── Media placeholder ── */`): a
// dot-mesh box at a fixed aspect ratio with an optional huge outlined number and the "No image yet" chip. App. D.3's
// markup, copy and props are kept; the look is utilities from brand.recipe.ts (D-33).
// SPEC-DEVIATION: D-33 strict CSP: the ratio goes through the `--ratio` custom property, read by the aspect utility
// next to the style below, instead of an inline `aspect-ratio` style (UI-SPEC "Inline style rule").
// SPEC-DEVIATION: D-33 `label={false}` hides the chip, for a parent that renders the placeholder itself as a tile,
// thumbnail or image fallback (the App. B/C parent rules `.csp-thumb .csp-media-ph-label`, `.s-tile …` become this
// prop, research "Rule category" row 21; UI-SPEC LazyImage). The image keeps its "No image yet" name.
import clsx from 'clsx';
import { Icon } from './Icon';
import { mediaLabelClasses, mediaNumberClasses, mediaPlaceholderClasses, meshClasses } from './brand.recipe';

export interface MediaPlaceholderProps {
  /** Names the missing image and fills the chip; `false` hides the chip. */
  label?: string | false;
  /** The outlined number drawn behind the chip (decorative). */
  number?: string | number | undefined;
  /** A CSS aspect ratio, for example `4 / 3` (the default) or `1 / 1`. */
  ratio?: string | undefined;
  /** Layout glue only. */
  className?: string;
}

export function MediaPlaceholder({ label, number, ratio = '4 / 3', className }: MediaPlaceholderProps) {
  // As App. D.3: an empty label counts as no label.
  const name = label === false || label === undefined || label === '' ? undefined : label;
  return (
    <div
      className={clsx(mediaPlaceholderClasses, 'aspect-(--ratio)', meshClasses, className)}
      style={{ '--ratio': ratio }}
      role="img"
      aria-label={name === undefined ? 'No image yet' : `${name} (no image yet)`}
    >
      {number !== undefined && number !== '' && (
        <span className={mediaNumberClasses} aria-hidden="true">
          {number}
        </span>
      )}
      {label !== false && (
        <span className={mediaLabelClasses}>
          <Icon name="image" size={16} />
          {name ?? 'No image yet'}
        </span>
      )}
    </div>
  );
}
