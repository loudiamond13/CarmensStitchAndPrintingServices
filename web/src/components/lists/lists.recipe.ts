// SPEC-GAP: list toolkit looks (UI-SPEC "SPEC-GAP Primitive Specs": ResponsiveTable, Pagination, SearchBox, FilterBar;
// spec §8.4, App. C `/* toolbar */` and `/* responsive table → cards on phones */`, App. E.7/E.12 list markup). The
// approved `.s-rt*`, `.s-toolbar*`, `.s-search-box`, `.s-resultbar`, `.s-filter-chip`, `.s-who`, `.s-acts`,
// `.s-iconbtn` and `.csp-cell-user` rules as complete Tailwind tokens (D-33). Every string in this file is a class list
// (the class gate compiles them all). Rule 8: the computed result of the approved cascade is reproduced, not its intent:
//   - D-38 (owner ruling A): on phones the last card's title has no separator, because the desktop "no border under the
//     last row" rule outranks the phone "border under the title" rule; both are one shared body-cell border list here.
//   - `.csp-cell-user span` reaches every span in the user cell (the avatar and the name's wrapper too), so the name and
//     the avatar initials take 12px `--ink-muted` as App. E.12 renders them (owner question logged, D-08).
//   - `.s-iconbtn` inside a filter chip carries App. E.7's inline `color: inherit`, which outranks its hover colour.
// Axes set disjoint properties: a cell's shared lists never set a property its kind, tone or money list also sets.
// The tablet `-webkit-overflow-scrolling: touch` is not transcribed: no current engine computes it (nothing to match).
import clsx from 'clsx';
import { tw } from '@/ui/tw';

/* ───────────── ResponsiveTable ───────────── */

/**
 * `.s-rt-wrap`: the bordered `--surface` frame, radius 12, scrolling sideways inside itself (tablet tables keep 680px).
 * Phones: no frame, no background, no clipping (the rows are the cards).
 * SPEC-DEVIATION: D-41 R2-02 (owner, 2026-10-13) the frame contains its paint from 768px up (`contain-paint`). App. C's
 * frame is not positioned, so the visually hidden (absolutely positioned) "Actions" header text was placed against the
 * page root; when the table scrolled inside its frame on a tablet, that text sat past the frame's right edge and let the
 * page scroll sideways (22px at 768px). Paint containment makes the frame its containing block, and the frame already
 * clips with `overflow-x-auto`, so only the table scrolls and nothing visible changes. Phones keep no containment
 * (`pg-phone:contain-none`): the rows are the cards there and the head is hidden. The rulings layer gives the frozen
 * reference the same containment, so the proof compares the same computed insets.
 */
export const tableWrapClasses = tw(
  'overflow-x-auto rounded-md border border-line bg-surface contain-paint pg-phone:overflow-visible pg-phone:border-0 pg-phone:bg-transparent pg-phone:contain-none',
);

/** `.s-rt`: full width, 14px/20px; at least 680px on tablets; a block on phones (preflight collapses the borders). */
export const tableClasses = tw('w-full text-[14px] leading-5 pg-phone:block pg-tablet:min-w-[680px]');

/** `.s-rt thead` on phones: hidden (each card labels its own values). */
export const tableHeadClasses = tw('pg-phone:hidden');

/** `.s-rt tbody` and `.s-rt tfoot` on phones: full-width blocks. */
export const tableSectionClasses = tw('pg-phone:block pg-phone:w-full');

const headCellBase = tw(
  'border-b border-line bg-surface px-4 py-3 text-[12px] font-bold tracking-[.06em] whitespace-nowrap text-ink-muted uppercase',
);

/** `.s-rt th` (start-aligned) and `.s-rt th.r` (money and action columns, end-aligned). */
export const tableHeadCellClasses = {
  start: clsx(headCellBase, tw('text-left')),
  end: clsx(headCellBase, tw('text-right')),
} as const;

/** `.s-rt tr` on phones: each row is a card, 12px apart, 12px by 16px padded, 1px `--line`, radius 12. */
const rowCard = tw(
  'pg-phone:relative pg-phone:mb-3 pg-phone:block pg-phone:w-full pg-phone:rounded-md pg-phone:border pg-phone:border-line pg-phone:px-4 pg-phone:py-3',
);

/**
 * `tbody tr`: `group/row`, so the cells follow the row's hover and last-row state. The card is `--surface`; an
 * inactive row's card is `--surface-2` (D-02), and a refetching list dims every card the same way, by colour only.
 */
export const tableRowClasses = {
  active: clsx(tw('group/row pg-phone:bg-surface pg-phone:in-data-[refetching=true]:bg-surface-2'), rowCard),
  inactive: clsx(tw('group/row pg-phone:bg-surface-2'), rowCard),
} as const;

/**
 * D-27 expandable rows (opt-in, only on a table that passes `detail`). An open row's card gives up its bottom corners,
 * bottom border and margin, so the detail row below it continues the same card on phones.
 */
export const openRowClasses = {
  active: tw(
    'group/row pg-phone:relative pg-phone:block pg-phone:w-full pg-phone:rounded-t-md pg-phone:border pg-phone:border-b-0 pg-phone:border-line pg-phone:bg-surface pg-phone:px-4 pg-phone:py-3 pg-phone:in-data-[refetching=true]:bg-surface-2',
  ),
  inactive: tw(
    'group/row pg-phone:relative pg-phone:block pg-phone:w-full pg-phone:rounded-t-md pg-phone:border pg-phone:border-b-0 pg-phone:border-line pg-phone:bg-surface-2 pg-phone:px-4 pg-phone:py-3',
  ),
} as const;

/** The detail row: on phones the lower half of the card (no top border), 12px clear of the next card. */
export const detailRowClasses = tw(
  'group/row pg-phone:mb-3 pg-phone:block pg-phone:w-full pg-phone:rounded-b-md pg-phone:border pg-phone:border-t-0 pg-phone:border-line pg-phone:bg-surface-2 pg-phone:px-4 pg-phone:pb-3',
);

/** The detail cell: one cell over every column, 16px padded on `--surface-2`, no top rule (the row above drops its own). */
export const detailCellClasses = tw(
  'border-b border-line bg-surface-2 p-4 text-left group-last/row:border-b-0 pg-phone:block pg-phone:w-full pg-phone:border-b-0 pg-phone:bg-transparent pg-phone:p-0',
);

/** A row that has a detail row below it drops its rule when open or last, so the detail row has no top divider. */
export const detailParentCellClasses = tw('group-data-[edge=true]/row:border-b-0');

/** `.s-rt tfoot tr` on phones: the totals card on `--surface-2`. */
export const tableFootRowClasses = clsx(tw('pg-phone:bg-surface-2'), rowCard);

/**
 * `.s-rt td` and `.s-rt td::before` shared by every body and footer cell: 12px by 16px, middle-aligned; on phones a
 * flex row (label left, value right, 12px apart) whose `::before` writes the cell's `data-label` in the 11px 700 .1em
 * upper-case `--ink-muted` label look.
 */
export const cellSharedClasses = tw(
  'px-4 py-3 align-middle pg-phone:flex pg-phone:items-center pg-phone:justify-between pg-phone:gap-3 pg-phone:before:text-left pg-phone:before:text-[11px] pg-phone:before:font-bold pg-phone:before:tracking-[.1em] pg-phone:before:text-ink-muted pg-phone:before:uppercase pg-phone:before:content-[attr(data-label)]',
);

/** `.s-rt td` 1px `--line` rule below, dropped on the last row (`.s-rt tbody tr:last-child td`, D-38). */
export const bodyCellBorderClasses = tw('border-b border-line group-last/row:border-b-0');

/**
 * Per cell kind on phones: a plain cell is a full-width row, 6px by 0, end-aligned, with no rule; the lead cell
 * (`td.is-lead`) is the card title, start-aligned, 8px below and 88px clear of the actions, keeping its rule; the
 * actions cell (`td.r.is-acts`) is pinned 6px from the card's top right. Lead and actions hide their label.
 */
export const bodyCellKindClasses = {
  plain: tw('pg-phone:w-full pg-phone:border-b-0 pg-phone:px-0 pg-phone:py-1.5 pg-phone:text-right'),
  lead: tw(
    'pg-phone:mb-1 pg-phone:w-full pg-phone:pt-1.5 pg-phone:pr-22 pg-phone:pb-2 pg-phone:pl-0 pg-phone:text-left pg-phone:before:hidden',
  ),
  actions: tw(
    'text-right pg-phone:absolute pg-phone:top-1.5 pg-phone:right-1.5 pg-phone:w-auto pg-phone:border-b-0 pg-phone:p-0 pg-phone:before:hidden',
  ),
} as const;

/**
 * Cell background: a row takes `--surface-2` on hover (transparent on phone cards); an inactive row keeps
 * `--surface-2` on every cell (D-02); a refetching list dims every cell to `--surface-2`, colour only (UI-SPEC "refetch").
 */
export const bodyCellToneClasses = {
  active: tw(
    'group-hover/row:bg-surface-2 in-data-[refetching=true]:bg-surface-2 pg-phone:group-hover/row:bg-transparent',
  ),
  inactive: tw('bg-surface-2'),
} as const;

/** `.s-rt tfoot td`: a 2px dashed `--line` rule above and the `.s-rt td` solid rule below, bold. */
export const footCellClasses = tw('border-t-2 border-b [border-top-style:dashed] border-line font-bold');

/**
 * Footer cells per kind on phones (`.s-rt tfoot td { border: 0; padding: 4px 0 }`): a plain cell is a full-width row,
 * end-aligned; the lead keeps the `td.is-lead` title spacing and its rule below (that rule outranks the footer one);
 * the actions cell is pinned to the card's top right.
 */
export const footCellKindClasses = {
  plain: tw('pg-phone:w-full pg-phone:border-0 pg-phone:px-0 pg-phone:py-1 pg-phone:text-right'),
  lead: tw(
    'pg-phone:mb-1 pg-phone:w-full pg-phone:border-t-0 pg-phone:pt-1 pg-phone:pr-22 pg-phone:pb-2 pg-phone:pl-0 pg-phone:text-left pg-phone:before:hidden',
  ),
  actions: tw(
    'text-right pg-phone:absolute pg-phone:top-1.5 pg-phone:right-1.5 pg-phone:w-auto pg-phone:border-0 pg-phone:p-0 pg-phone:before:hidden',
  ),
} as const;

/** `.s-rt .r.m`: a money cell, end-aligned, tabular, 600, on one line. */
export const moneyCellClasses = tw('text-right font-semibold whitespace-nowrap tabular-nums');

/** `.s-muted`: a muted cell (App. E.12 "Created"). */
export const mutedCellClasses = tw('text-ink-muted');

/* ───────────── Cells ───────────── */

/** `.csp-cell-user`: the avatar and the name block, 12px apart. */
export const cellUserClasses = tw('flex items-center gap-3');

/**
 * `.csp-cell-user span` on the name's wrapper span: 12px `--ink-muted` (it also reaches the name, rule 8). A long name or
 * sub line wraps anywhere (it may shrink beside the avatar) instead of widening the table.
 */
export const cellUserTextClasses = tw('min-w-0 text-[12px] wrap-anywhere text-ink-muted');

/** `.csp-cell-user strong`: the name on its own line, 600. */
export const cellUserNameClasses = tw('block font-semibold');

/** `.csp-cell-user span` on the sub line ("You" or the role). */
export const cellUserSubClasses = tw('text-[12px] text-ink-muted');

/** `.s-who strong`: the team (or customer) on its own line, 600. */
export const whoTitleClasses = tw('block font-semibold');

/** `.s-who span`: the customer (or "Walk-in customer") on its own line, 12px/16px `--ink-muted`. */
export const whoSubClasses = tw('block text-[12px] leading-4 text-ink-muted');

// SPEC-DEVIATION: D-51 (owner, WR-20) App. E `.s-acts` puts 2px between the icon buttons; 8px lets each button have a 44px
// tap area without touching its neighbour's.
/** `.s-acts`: the row's icon buttons, 8px apart, end-aligned. */
export const rowActionsClasses = tw('inline-flex justify-end gap-2');

const iconButtonBase = tw(
  'inline-grid size-9 cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-ink-muted',
);

/** `.s-iconbtn` (hover `--surface-2` / `--ink`) and `.s-iconbtn.is-danger` (hover `--danger-soft` / `--danger`). */
export const rowActionClasses = {
  neutral: clsx(iconButtonBase, tw('hover:bg-surface-2 hover:text-ink')),
  danger: clsx(iconButtonBase, tw('hover:bg-danger-soft hover:text-danger')),
} as const;

/**
 * D-27 an expand toggle's chevron: it turns 180 degrees over 0.2s when its row is open, and does not move under reduced
 * motion. Only a RowAction with `expanded` carries it.
 */
export const rowActionChevronClasses = {
  closed: tw('transition-transform duration-200 motion-reduce:transition-none'),
  open: tw('rotate-180 transition-transform duration-200 motion-reduce:transition-none'),
} as const;

/* ───────────── FilterBar, SearchBox, ResultBar, FilterChip ───────────── */

/**
 * `.s-toolbar`: the `--surface` card, 16px padded (12px on phones), 1px `--line`, radius 12, wrapping its fields 12px
 * apart and aligned to the bottom. Tablets: `.s-toolbar > :first-child { flex: 1 1 100% !important }` (the search takes
 * its own row).
 */
export const toolbarClasses = tw(
  'flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-4 pg-phone:p-3 pg-tablet:[&>:first-child]:flex-[1_1_100%]!',
);

/** `.s-toolbar-end`: pushed to the end, 8px gaps; phones: its own full-width row; tablets: aligned to the bottom. */
export const toolbarEndClasses = tw(
  'ml-auto flex items-center gap-2 pg-phone:ml-0 pg-phone:w-full pg-phone:justify-between pg-tablet:ml-0 pg-tablet:self-end',
);

/** App. E.7's search column (`display: flex; flex-direction: column; gap: 6px; flex: 1 1 260px`, `.s-toolbar .s-search`). */
export const searchClasses = tw('flex flex-[1_1_260px] flex-col gap-1.5');

/** The `.csp-label` with App. E.7's inline 12px/16px `--ink-muted`; the weight stays `.csp-label`'s 600. */
export const searchLabelClasses = tw('text-[12px] leading-4 font-semibold text-ink-muted');

/**
 * `.s-search-box`: 42px, 12px padded, `--surface-2` with a 1px `--line-strong` border, radius 8, `--ink-muted` icon.
 * SPEC-DEVIATION: D-60 UI-06-05 42px (spec: 40px) so it lines up with toolbar fields, whose 40px input sits inside a
 * 1px border.
 * SPEC-DEVIATION: D-41 R2-03 (owner, 2026-10-13) a focus ring of its own, subtler than the shared field ring: while
 * the input has focus, the box's own 1px border turns `--focus` (no outer box-shadow ring, no transition, no change in
 * size). App. E.7 gave the box no focus look at all (its input has `outline: none`). `--focus` against the adjacent
 * colours (WCAG 1.4.11 at least 3:1, search-focus-contrast.node.test.ts): Blush 9.01:1 on `--surface-2` (inside),
 * 9.88:1 on `--surface` (the toolbar) and 8.95:1 on `--bg`; Espresso 6.80:1, 7.49:1 and 7.99:1. The box is in normal
 * flow, so the border is never obscured (2.4.11).
 */
export const searchBoxClasses = tw(
  'flex h-10.5 items-center gap-2 rounded-sm border border-line-strong bg-surface-2 px-3 text-ink-muted focus-within:border-focus',
);

/**
 * `.s-search-box input`: borderless, transparent, no outline (the box shows the focus, D-41 R2-03), 14px `--ink` (16px
 * on phones, D-01), `--ink-muted` placeholder, and App. A.3 compat.css's restored browser padding (1px 2px).
 */
export const searchInputClasses = tw(
  'min-w-0 flex-1 border-0 bg-transparent px-0.5 py-px text-[14px] text-ink [outline:none] placeholder:text-ink-muted pg-phone:text-[16px]',
);

/** `.s-resultbar`: 13px `--ink-muted`, wrapping, the count left and the chips right, 12px apart. */
export const resultBarClasses = tw('flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-muted');

/** App. E.7's `<strong style="color: var(--ink)">` count. */
export const resultCountClasses = tw('text-ink');

/** The chip group (UI-SPEC overflow row): chips wrap onto new lines 8px apart and never widen the page. */
export const chipGroupClasses = tw('flex max-w-full min-w-0 flex-wrap gap-2');

/** `.s-filter-chip`: 28px, `--accent-soft` / `--accent-ink`, 12px 600, radius 4, at most the bar's width. */
export const filterChipClasses = tw(
  'inline-flex h-7 max-w-full items-center gap-1.5 rounded-xs bg-accent-soft pr-1.5 pl-2.5 text-[12px] font-semibold text-accent-ink',
);

/** The chip label: truncated with an ellipsis when the chip hits the bar's width. */
export const filterChipLabelClasses = tw('min-w-0 truncate');

/** `.s-iconbtn` at App. E.7's inline 22px with `color: inherit` (O-8 size kept); it never shrinks. */
export const filterChipClearClasses = tw(
  'inline-grid size-[22px] flex-none cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-inherit hover:bg-surface-2',
);

/* ───────────── Pagination ───────────── */

/** The pagination row: Previous, the status and Next spread apart, 12px gaps, wrapping when the size select joins. */
export const paginationClasses = tw('flex flex-wrap items-center justify-between gap-3');

/** Phones: the Previous/Next buttons become 44×44 icons (the label span is hidden; the accessible names stay). */
export const paginationButtonClasses = tw('pg-phone:w-11 pg-phone:px-0 pg-phone:[&>span]:hidden');

/** "Page {p} of {n}": 14px/20px `--ink-muted`. */
export const paginationStatusClasses = tw('text-[14px] leading-5 text-ink-muted');

/** The page and page count: `--ink`, 600, tabular. */
export const paginationNumberClasses = tw('font-semibold text-ink tabular-nums');

/* ───────────── SkeletonTable ───────────── */

/** The skeleton actions cell's fixed width (the cell shrinks to fit on phone cards). */
export const skeletonActionsClasses = tw('inline-block w-18');
