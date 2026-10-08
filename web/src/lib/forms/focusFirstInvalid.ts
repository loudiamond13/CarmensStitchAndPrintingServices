// UI-SPEC Interaction Contract "Validation" (spec 10, PRD 9.4): after a failed save, focus moves to the first invalid
// field, so keyboard and screen-reader users land on the message that needs them.

/**
 * Focuses the first element inside `root` (in DOM order) that has aria-invalid="true".
 * @returns true when an element was focused; false, with focus left alone, when nothing is invalid.
 */
export function focusFirstInvalid(root: HTMLElement): boolean {
  const first = root.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (first === null) {
    return false;
  }
  first.focus();
  return true;
}
