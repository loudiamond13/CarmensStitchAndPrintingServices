// Where the Get a Quote form sits on the Contact page, and what the header "Get a Quote" does when the visitor is already there
// (UI-SPEC Q1): scroll the form into view and put focus on its first field. The page already keeps the header's height and 24px
// as its scroll padding, so the form stops clear of the header. Smooth scrolling is off under reduced motion.

/** The id of the Contact column that holds the form (or its placeholder while it loads). */
export const QUOTE_FORM_ID = 'quote-form';

export function focusQuoteForm(): void {
  const column = document.getElementById(QUOTE_FORM_ID);
  if (column === null) {
    return;
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  column.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  column.querySelector<HTMLElement>('input, select, textarea')?.focus({ preventScroll: true });
}
