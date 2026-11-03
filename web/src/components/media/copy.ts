// SPEC-GAP: media copy (UI-SPEC "Copywriting Contract" → Viewer, "Announcements" → Viewer change). The plain-English
// strings of the photo viewer in one module, so the owner can change them in one place and no JSX carries its own wording.

/** The copy of the media components (plan 09-04). */
export const MEDIA_COPY = {
  /** PhotoViewer (D-16, D-04, D-27). */
  viewer: {
    counter: (position: number, total: number): string => `Photo ${String(position)} of ${String(total)}`,
    close: 'Close viewer',
    previous: 'Previous image',
    next: 'Next image',
    openFullSize: 'Open Full Size',
    opensInNewTab: '(opens in a new tab)',
    /** The polite announcement on each change. */
    announce: (position: number, total: number, description: string): string =>
      `Photo ${String(position)} of ${String(total)}: ${description}`,
  },
} as const;
