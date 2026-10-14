// Shared by the dev-only dialog wrappers (plan 02-22; never shipped, D-20).

/** Sets an input's value the way typing does (the native setter, then an input event), so React's onChange sees it. */
export function typeInto(input: HTMLInputElement, text: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
