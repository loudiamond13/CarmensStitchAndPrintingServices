// The request the public layout sends when the header "Get a Quote" is pressed on the Contact page (UI-SPEC Q1). It is its own tiny
// module on purpose: the layout loads on every public page, and the scroll and focus code that answers it ships with the Contact
// page only (quoteFormTarget.ts, PERF-01).

/** The window event the layout sends and the Contact page listens for. */
export const QUOTE_FOCUS_EVENT = 'csps:focus-quote-form';

/** Asks the Contact page to show its form. Does nothing when no page is listening. */
export function requestQuoteFormFocus(): void {
  window.dispatchEvent(new Event(QUOTE_FOCUS_EVENT));
}
