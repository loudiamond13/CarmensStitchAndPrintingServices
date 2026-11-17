// Where focus goes when a choice closes the cookie bar (ANL-07, A11Y-02): PublicLayout's `main#main`, without scrolling, so
// a keyboard visitor is not left on a removed button. Shared by the bar and the settings window.

export function focusMain(): void {
  document.getElementById('main')?.focus({ preventScroll: true });
}

/** Focuses main when the bar is not asking, else as soon as a choice closes it. */
export function focusMainWhenChosen(): void {
  // Stub: the real rule comes with the next commit.
}
