// The admin shell copy (UI-SPEC Copywriting Contract). Strings marked SPEC-GAP are new; the owner can change them later.
export const ADMIN_COPY = {
  /** The document title is "{Section} · CSPS Admin" (UI-SPEC AdminPreviewPage). */
  titleSuffix: ' · CSPS Admin',
  // SPEC-GAP: the screen for an admin section whose page is built in a later phase; plain wording, owner to confirm.
  notFound: {
    title: 'Page not found',
    emptyTitle: 'Nothing here yet',
    emptyMessage: 'This screen is not available yet. Use the menu to go to another page.',
  },
  // Owner copy (D-45): the toast when Logout fails and the person stays signed in.
  signOutFailed: { title: 'We couldn’t sign you out.', message: 'Check your connection and try again.' },
} as const;
