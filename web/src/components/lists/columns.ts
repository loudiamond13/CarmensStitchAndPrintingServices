// SPEC-GAP: the ResponsiveTable column model (plan 02-30), shared by ResponsiveTable and SkeletonTable: what a column
// declares, which cell kind it renders (the card title, the row actions or a plain value) and which side its header
// sits on. No looks here; the classes live in lists.recipe.ts.
import type { ReactNode } from 'react';

export interface ResponsiveTableColumn<T> {
  key: string;
  /** The column header; also the phone card label unless `label` is given. */
  header: string;
  /** The phone card label (`data-label`) when it differs from the header ("Customer / team" → "Customer"). */
  label?: string | undefined;
  /** The cell content. null, undefined, false or '' renders EmptyValue (spec §9.4, OR-4); an actions cell stays empty. */
  cell: (row: T) => ReactNode;
  /** The card title on phones (`td.is-lead`). */
  lead?: boolean | undefined;
  /** The row actions (`td.r.is-acts`); the header text is visually hidden. */
  actions?: boolean | undefined;
  /**
   * Many row actions (more than three 36px buttons would cover the card title): on phones the actions cell sits in the card under the other
   * cells, end-aligned, instead of pinned to the top right over the title. Only with `actions`.
   */
  flowActions?: boolean | undefined;
  /** An end-aligned tabular money cell (`th.r`, `td.r.m`). */
  money?: boolean | undefined;
  /** A muted cell (`.s-muted`, like App. E.12 "Created"). */
  muted?: boolean | undefined;
}

/**
 * The cell looks: the phone card title (`td.is-lead`), the pinned actions (`td.is-acts`), actions that flow in the card (`flowActions`) or a
 * plain value.
 */
export type CellKind = 'plain' | 'lead' | 'actions' | 'flowActions';

export function kindOf(column: Pick<ResponsiveTableColumn<never>, 'lead' | 'actions' | 'flowActions'>): CellKind {
  if (column.lead === true) return 'lead';
  if (column.actions === true) return column.flowActions === true ? 'flowActions' : 'actions';
  return 'plain';
}

/** Money and action columns are end-aligned (`th.r`); the rest start-aligned. */
export function headSide(column: Pick<ResponsiveTableColumn<never>, 'money' | 'actions'>): 'start' | 'end' {
  return column.money === true || column.actions === true ? 'end' : 'start';
}
