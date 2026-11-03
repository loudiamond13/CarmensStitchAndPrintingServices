// The photo list looks (App. B `/* ── Image uploader ── */` and `.csp-linkbtn`, CSPS-UI-SPEC.md §6.3, and Phase 9 UI-SPEC
// P1) as complete Tailwind tokens (D-33). Every string in this file is a class list (the class gate reads them all).
//
// The grip reveal (owner ruling D-05: `opacity-0 group-hover/thumb:opacity-100 group-focus-within/thumb:opacity-100`)
// is not in this file. The class gate allows those opacity tokens only in src/components/media/PhotoTile*
// (web/scripts/class-gate.config.mjs, D-02), so the reveal list sits in PhotoTile.tsx next to the grip it hides.
import { tw } from '@/ui/tw';

/** The uploader: the pick errors, the add area and the photo list, 16px apart. */
export const uploaderClasses = tw('flex flex-col gap-4');

/**
 * `.csp-drop` and `.csp-drop.is-over`: the dashed drop zone on `--surface-2` (2px `--line-strong`, 32px by 16px
 * padded, centred `--ink-muted` text). While files are dragged over it (`data-over="true"`) it takes the accent
 * border, wash and ink. It shows only on devices that hover (D-17); `no-hover:hidden` takes it away on touch.
 */
export const dropClasses = tw(
  'flex flex-col items-center gap-1 rounded-md border-2 border-dashed border-line-strong bg-surface-2 px-4 py-8 text-center text-ink-muted transition-[border-color,background-color] duration-150 ease-[ease] data-[over=true]:border-accent-line data-[over=true]:bg-accent-soft data-[over=true]:text-accent-ink no-hover:hidden',
);

/**
 * `.csp-drop-title`: "Drag images here or browse" in `--ink` 600. App. B also gives it `margin: 8px 0 0`, but App. C's
 * `.s-page p { margin: 0 }` wins in the approved page, so the title has no margin.
 */
export const dropTitleClasses = tw('font-semibold text-ink');

/** `.csp-drop-hint`: "JPG, PNG, WEBP or HEIC · up to 10 MB each · {n}/5", 12px/16px. */
export const dropHintClasses = tw('text-[12px] leading-4');

/**
 * `.csp-linkbtn`: a button that reads as a link: no border or padding, `--link` 650, underlined 3px below the text.
 * Preflight already gives the button an inherited font and a transparent background (research rule 28).
 */
export const linkButtonClasses = tw(
  'cursor-pointer border-0 p-0 font-button text-link underline underline-offset-[3px]',
);

/** The touch add area (D-17): hidden on devices that hover, a column of the button row and the hint where hover is none. */
export const touchAddClasses = tw('hidden flex-col gap-2 no-hover:flex');

/** "Take Photo" and "Choose Photos": one row; they wrap onto two rows when the card is too narrow for both. */
export const touchRowClasses = tw('flex flex-wrap gap-2');

/** Each touch button shares the row. */
export const touchButtonClasses = tw('flex-1 basis-36');

/** The hint under the touch buttons: Small, `--ink-muted`. */
export const touchHintClasses = tw('m-0 text-[14px] leading-5 text-ink-muted');

/** The photo list: columns of at least 280px (one on phones), 16px apart. */
export const photoListClasses = tw(
  'm-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4 p-0',
);

/** One photo tile: `--surface`, a 1px `--line`, radius-md, 8px padding, two rows 8px apart. */
export const tileClasses = tw('group/thumb flex min-w-0 flex-col gap-2 rounded-md border border-line bg-surface p-2');

/** A tile whose photo can be dragged (hover devices, live and draft). */
export const tileDraggableClasses = tw('cursor-grab');

/** Row 1: the thumb, then the info column, 8px apart. */
export const tileRowClasses = tw('flex min-w-0 gap-2');

/** The 88 by 88 thumb box, clipped and rounded. */
export const thumbBoxClasses = tw('relative size-22 shrink-0 overflow-hidden rounded-sm bg-surface-2');

/** `.csp-thumb` (a 1px inset `--line` ring) and `.csp-thumb.is-cover` (a 2px outer `--accent-line` ring). */
export const thumbRingClasses = {
  cover: tw('[box-shadow:0_0_0_2px_var(--accent-line)]'),
  plain: tw('[box-shadow:inset_0_0_0_1px_var(--line)]'),
} as const;

/** The saved photo's thumb button fills the box. */
export const thumbButtonClasses = tw('block size-full cursor-pointer border-0 bg-transparent p-0');

/** A draft or pending photo's `data:` preview fills the box. */
export const thumbImageClasses = tw('block size-full object-cover');

/** The chip-less placeholder fills the box. */
export const thumbPlaceholderClasses = tw('size-full');

/** `.csp-thumb-cover`: the orange "Cover" tag, 6px from the bottom left, 11px/16px 700 upper case, .08em tracking. */
export const thumbCoverClasses = tw(
  'absolute bottom-1.5 left-1.5 rounded-xs bg-accent px-1.5 py-0.5 text-[11px] leading-4 font-bold tracking-[.08em] text-on-accent uppercase',
);

/**
 * `.csp-thumb-grip`: the decorative drag grip, 4px from the left and 6px from the top in `--ink` with a 1px `--bg` drop
 * shadow; its opacity changes over .15s. It never takes a press, so the thumb under it stays pressable.
 */
export const thumbGripClasses = tw(
  'pointer-events-none absolute top-1.5 left-1 text-ink [filter:drop-shadow(0_1px_1px_var(--bg))] transition-[opacity] duration-150 ease-[ease]',
);

/** The info column beside the thumb. */
export const infoClasses = tw('flex min-w-0 flex-1 flex-col items-start gap-1');

/** "Photo {n} of {total}": Label, 14px 600. */
export const positionLabelClasses = tw('text-[14px] leading-5 font-semibold text-ink');

/** The description: Small, `--ink-muted`, two lines at most, a long word wraps anywhere. */
export const descriptionClasses = tw('line-clamp-2 text-[14px] leading-5 wrap-anywhere text-ink-muted');

/** "Make Cover" sits 4px below the description. */
export const makeCoverClasses = tw('mt-1');

/** A file name on a waiting, uploading or failed tile: Label, two lines at most. */
export const fileNameClasses = tw('line-clamp-2 text-[14px] leading-5 font-semibold wrap-anywhere text-ink');

/** The status line of a waiting, uploading or failed tile: Small, an icon then a word. */
export const statusClasses = {
  muted: tw('flex items-start gap-1 text-[14px] leading-5 wrap-anywhere text-ink-muted'),
  danger: tw('flex items-start gap-1 text-[14px] leading-5 wrap-anywhere text-danger'),
} as const;

/** The icon of a status line, level with the first line of text. */
export const statusIconClasses = tw('flex h-5 shrink-0 items-center');

/** The status spinner; it stands still under reduced motion. */
export const spinnerClasses = tw('animate-csp-spin motion-reduce:animate-none');

/** Row 2: the move group on the left and the edit and remove group on the right. */
export const actionsRowClasses = tw('flex flex-wrap items-center justify-between gap-2');

/** Row 2 of an uploading tile has no buttons and keeps the height of a small button. */
export const actionsRowIdleClasses = tw('min-h-9');

/** One group of icon buttons, 8px apart. */
export const actionsGroupClasses = tw('flex gap-2');
