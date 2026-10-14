// The image uploader looks (App. B `/* ── Image uploader ── */` and `.csp-linkbtn`, CSPS-UI-SPEC.md §6.3) as complete
// Tailwind tokens (D-33). Every string in this file is a class list (the class gate reads them all).
//
// The thumb grip and actions reveal (owner ruling D-05: `opacity-0 group-hover/thumb:opacity-100
// group-focus-within/thumb:opacity-100 no-hover:opacity-100`) is not in this file. The class gate allows those
// opacity tokens only in src/components/media/ImageUploader* (web/scripts/class-gate.config.mjs, D-02), so the reveal list
// sits in ImageUploader.tsx next to the grip and actions it hides; thumbGripClasses and thumbActionsClasses below hold
// the rest of their looks.
import { tw } from '@/ui/tw';

/** `.csp-uploader`: the drop zone above the thumbnail grid, 16px apart. */
export const uploaderClasses = tw('flex flex-col gap-4');

/**
 * `.csp-drop` and `.csp-drop.is-over`: the dashed drop zone on `--surface-2` (2px `--line-strong`, 32px by 16px
 * padded, centred `--ink-muted` text). While files are dragged over it (`data-over="true"`) it takes the accent
 * border, wash and ink. Border colour and background change over .15s ease.
 */
export const dropClasses = tw(
  'flex flex-col items-center gap-1 rounded-md border-2 border-dashed border-line-strong bg-surface-2 px-4 py-8 text-center text-ink-muted transition-[border-color,background-color] duration-150 ease-[ease] data-[over=true]:border-accent-line data-[over=true]:bg-accent-soft data-[over=true]:text-accent-ink',
);

/**
 * `.csp-drop-title`: "Drag images here or browse" in `--ink` 600. App. B also gives it `margin: 8px 0 0`, but App. C's
 * `.s-page p { margin: 0 }` wins in the approved page, so the title has no margin.
 */
export const dropTitleClasses = tw('font-semibold text-ink');

/** `.csp-drop-hint`: "JPG, PNG or WEBP · up to 10 MB each · {n}/{max}", 12px/16px. */
export const dropHintClasses = tw('text-[12px] leading-4');

/**
 * `.csp-linkbtn`: a button that reads as a link: no border or padding, `--link` 650, underlined 3px below the text.
 * Preflight already gives the button an inherited font and a transparent background (research rule 28).
 */
export const linkButtonClasses = tw(
  'cursor-pointer border-0 p-0 font-button text-link underline underline-offset-[3px]',
);

/** `.csp-thumbs`: the thumbnail grid, as many 104px-or-wider columns as fit, 12px apart. */
export const thumbsClasses = tw('m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-3 p-0');

/**
 * `.csp-thumb`: a square, clipped, rounded tile on `--surface-2` with the grab cursor. `group/thumb` lets the grip and
 * the actions follow the thumb's hover and focus within (D-05). Its ring is in thumbRingClasses.
 */
export const thumbClasses = tw(
  'group/thumb relative [aspect-ratio:1] cursor-grab overflow-hidden rounded-md bg-surface-2',
);

/** `.csp-thumb` (a 1px inset `--line` ring) and `.csp-thumb.is-cover` (a 2px outer `--accent-line` ring). */
export const thumbRingClasses = {
  cover: tw('[box-shadow:0_0_0_2px_var(--accent-line)]'),
  plain: tw('[box-shadow:inset_0_0_0_1px_var(--line)]'),
} as const;

/** `.csp-thumb img`: the photo fills the tile. */
export const thumbImageClasses = tw('block h-full w-full object-cover');

/**
 * `.csp-thumb .csp-media-ph` and `.csp-thumb .csp-media-ph-num`: the chip-less placeholder fills the tile, and its
 * outlined number is centred across (right 50%, then translate(50%, -50%)) instead of sitting at the right. The number
 * is the placeholder's only child here (the chip is off, `label={false}`).
 */
export const thumbPlaceholderClasses = tw('h-full *:right-[50%] *:[transform:translate(50%,-50%)]');

/** `.csp-thumb-cover`: the orange "Cover" tag, 6px from the bottom left, 11px/16px 700 upper case, .08em tracking. */
export const thumbCoverClasses = tw(
  'absolute bottom-1.5 left-1.5 rounded-xs bg-accent px-1.5 py-0.5 text-[11px] leading-4 font-bold tracking-[.08em] text-on-accent uppercase',
);

/**
 * `.csp-thumb-grip`: the drag grip, 4px from the left and 6px from the top in `--ink` with a 1px `--bg` drop shadow;
 * its opacity changes over .15s.
 */
export const thumbGripClasses = tw(
  'absolute top-1.5 left-1 text-ink [filter:drop-shadow(0_1px_1px_var(--bg))] transition-[opacity] duration-150 ease-[ease]',
);

/** `.csp-thumb-actions`: the cover and remove buttons, 6px from the top right, 4px apart; opacity over .15s. */
export const thumbActionsClasses = tw(
  'absolute top-1.5 right-1.5 flex gap-1 transition-[opacity] duration-150 ease-[ease]',
);

/** `.csp-thumb-btn`: a 28px square button on `--surface-3` with `--shadow-2`; on hover it turns `--danger`. */
export const thumbButtonClasses = tw(
  'grid size-7 cursor-pointer place-items-center rounded-[6px] border-0 bg-surface-3 text-ink [box-shadow:var(--shadow-2)] hover:bg-danger hover:text-on-danger',
);
