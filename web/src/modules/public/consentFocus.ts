// Where focus goes when a choice closes the cookie bar (ANL-07, A11Y-02): PublicLayout's `main#main`, without scrolling, so
// a keyboard visitor is not left on a removed button. Shared by the bar and the settings window.

export function focusMain(): void {
  document.getElementById('main')?.focus({ preventScroll: true });
}
