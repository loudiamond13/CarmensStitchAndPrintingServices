// SPEC-GAP: states copy (UI-SPEC "Copywriting Contract": Error state, Loading announcement). The plain-English strings
// of the loading, error and image states the spec does not draw, in one module, so the owner can change them in one
// place and no JSX carries its own wording.

/** The copy of the state primitives (plan 02-28). `things` is the plural noun of the list, like "orders". */
export const STATES_COPY = {
  /** ErrorState (App. E.8 "Couldn't load"). */
  error: {
    loadFailedTitle: (things: string): string => `Couldn't load ${things}.`,
    loadFailedBody: 'Check your internet connection. Your data is safe. Nothing was changed.',
    /** The one server value the banner shows (T-02-62, CWE-209). */
    reference: (traceId: string): string => `Reference: ${traceId}`,
    retry: 'Try Again',
  },
  /** ConflictBanner (D-20, SEC-07): the stale-save banner every aggregate form shares, and the live line after Load Latest. */
  conflict: {
    title: 'This was changed by someone else.',
    body: 'Reload and try again. Your typed changes stay here until you press Load Latest.',
    loadLatest: 'Load Latest',
    loading: 'Loading',
    loaded: 'Latest version loaded. Make your changes again.',
  },
  /** The hidden text of EmptyValue (spec §9.4 Empty, OR-4). */
  emptyValue: 'Not set',
  /** LoadingRegion's polite announcements ("Loading announcement"). */
  loading: {
    loading: (things: string): string => `Loading ${things}…`,
    loaded: (things: string): string => `${capitalize(things)} loaded.`,
  },
} as const;

/** "orders" -> "Orders", for the sentence-initial "{Things} loaded." */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
