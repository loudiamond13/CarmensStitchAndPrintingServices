// The admin shell copy (UI-SPEC Copywriting Contract; plan 02-31). Dev-only screens: none of it reaches a production
// build (D-20). Strings marked SPEC-GAP are new; the owner can change them later.
export const ADMIN_COPY = {
  /** The document title is "{Section} · CSPS Admin" (UI-SPEC AdminPreviewPage). */
  titleSuffix: ' · CSPS Admin',
  preview: {
    subline: 'Development only. This screen is built in a later phase.',
    // SPEC-GAP: the UI-SPEC names the empty state's icon and action but not its words; plain wording, owner to confirm.
    emptyTitle: 'Nothing to show here yet',
    emptyMessage: 'Until this screen is built, the Component Showcase shows every shared building block.',
    showcase: 'Open Component Showcase',
  },
  /** SPEC-GAP, Phase 2 only: Logout in the dev shell. Phase 4 wires the real sign-out. */
  logoutToast: { title: 'Not available yet', message: 'Sign-out comes with the sign-in phase.' },
} as const;
