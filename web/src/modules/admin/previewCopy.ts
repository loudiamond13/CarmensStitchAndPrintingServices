// The copy of the dev-only preview pages (D-20). Kept apart from copy.ts so no production chunk carries it.
export const PREVIEW_COPY = {
  subline: 'Development only. This screen is built in a later phase.',
  // SPEC-GAP: the UI-SPEC names the empty state's icon and action but not its words; plain wording, owner to confirm.
  emptyTitle: 'Nothing to show here yet',
  emptyMessage: 'Until this screen is built, the Component Showcase shows every shared building block.',
  showcase: 'Open Component Showcase',
} as const;
