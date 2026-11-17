// SPEC-GAP: the shape of every legal text module (UI-SPEC L1; LEGAL-05, D-10). A text module holds the sections of one legal page as
// data, so the words change only through a reviewed release and legal-content.node.test.ts can check every module the same way.
import type { LegalPageMeta } from './legalPages';

/** A piece of running text: plain text, or a link (`external` opens a new tab). */
export type LegalInline = string | { readonly text: string; readonly href: string; readonly external?: boolean };

export type LegalBlock =
  | { readonly kind: 'p'; readonly parts: readonly LegalInline[] }
  | { readonly kind: 'ul'; readonly items: readonly (readonly LegalInline[])[] }
  | {
      readonly kind: 'dl';
      readonly items: readonly {
        readonly term: string;
        readonly parts: readonly LegalInline[];
        /** Further description lines after the first, each its own `dd`. */
        readonly more?: readonly (readonly LegalInline[])[];
      }[];
    }
  | { readonly kind: 'h3'; readonly text: string }
  | { readonly kind: 'facts'; readonly show: readonly ('business' | 'dpo' | 'contact')[] };

export interface LegalSectionData {
  /** Kebab-case; the table of contents links to `#{id}`. */
  readonly id: string;
  readonly heading: string;
  readonly blocks: readonly LegalBlock[];
}

export interface LegalText {
  /** The version, date and approval flag come from legalPages.ts. */
  readonly meta: LegalPageMeta;
  readonly sections: readonly LegalSectionData[];
}
