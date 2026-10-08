// The registry of everything the look-equality proof is allowed to treat as different (WEB-02, D-33, UI-SPEC
// "Intentional differences"). Look rulings (D-01, D-02, D-03, D-05, D-31, WEB-09, PERF-05) are NOT here: they sit in
// the reference's rulings layer (visual/reference/rulings.css), so the two sides render equal. This file holds only
// what cannot be made equal by CSS:
//   - STRUCTURAL_EXCEPTIONS: an element whose tag differs on purpose (paired by scenario id and DOM path), and the icon
//     drawings, which are masked while the icon wrapper is still compared;
//   - TOLERANCE_OVERRIDES: a per-scenario pixel tolerance. It is empty, and an entry needs an owner decision and a
//     reason the owner can read (threat T-02-39: drift must never hide behind a tolerance).
// Every entry carries a decision ID; assertRegistry() (run by the parity suite at load and by compare.test.ts) rejects
// an entry without one.

/** An element the implementation renders with another tag on purpose; styles, box and pixels must still be equal. */
export interface ElementException {
  readonly kind: 'element';
  /** The scenario id (the `[data-case]` value). */
  readonly scenario: string;
  /** The child-index path from the case root, as compare.ts records it (`0` is the root, `0/2/1` its third child's second child). */
  readonly path: string;
  /** The tag the approved design renders there. */
  readonly reference: string;
  /** The tag the implementation renders there. */
  readonly impl: string;
  readonly decision: string;
  readonly reason: string;
}

/** Icon drawings: every `<svg viewBox>` with this value is compared as a wrapper only, and masked in screenshots. */
export interface DrawingMask {
  readonly kind: 'icon-drawing';
  readonly viewBox: string;
  readonly decision: string;
  readonly reason: string;
}

export type StructuralException = ElementException | DrawingMask;

/** A per-scenario pixel tolerance. Needs an owner decision and a reason the owner can read. */
export interface ToleranceOverride {
  readonly scenario: string;
  readonly maxDiffPixels: number;
  readonly decision: string;
  readonly reason: string;
}

const LOGOUT_REASON =
  'The Sidebar Logout is a <button type="button"> instead of the approved <a href="#">, with the same look ' +
  '(owner-confirmed, D-31). Plan 02-26 confirms each path when it adds the sidebar scenarios.';

export const STRUCTURAL_EXCEPTIONS: readonly StructuralException[] = Object.freeze([
  // D-27: [data-case] > aside > .csp-sidebar-foot > Logout. The foot holds the user chip first when it is shown
  // (expanded, with a user), so Logout is its second child there and its first child on the collapsed sidebar.
  {
    kind: 'element',
    scenario: 'sidebar-dashboard-current',
    path: '0/0/2/1',
    reference: 'a',
    impl: 'button',
    decision: 'D-27',
    reason: LOGOUT_REASON,
  },
  {
    kind: 'element',
    scenario: 'sidebar-users-current',
    path: '0/0/2/1',
    reference: 'a',
    impl: 'button',
    decision: 'D-27',
    reason: LOGOUT_REASON,
  },
  {
    kind: 'element',
    scenario: 'sidebar-collapsed',
    path: '0/0/2/0',
    reference: 'a',
    impl: 'button',
    decision: 'D-27',
    reason: LOGOUT_REASON,
  },
  // D-32: the approved design draws its icons from App. D.5 node data; the app uses lucide-react 1.53.0 (D-34), whose
  // drawings the owner approved separately. Both render a 24 x 24 viewBox wrapper.
  {
    kind: 'icon-drawing',
    viewBox: '0 0 24 24',
    decision: 'D-32',
    reason:
      'Icon drawings come from lucide-react 1.53.0 (20 of 56 redrawn, approved by the owner); the wrapper size, ' +
      'colour, stroke, display and alignment are still compared, and the drawing is masked in screenshots.',
  },
] satisfies readonly StructuralException[]);

/** Empty on purpose: every case must be pixel-identical. An entry needs an owner decision (D-08) and a reason. */
export const TOLERANCE_OVERRIDES: readonly ToleranceOverride[] = Object.freeze([]);

// RED stubs (plan 02-14 Task 2): the checks and lookups arrive with the GREEN step.
export function assertRegistry(
  _structural: readonly StructuralException[] = STRUCTURAL_EXCEPTIONS,
  _tolerances: readonly ToleranceOverride[] = TOLERANCE_OVERRIDES,
): void {
  return undefined;
}

export function elementExceptionsFor(
  _scenario: string,
  _structural: readonly StructuralException[] = STRUCTURAL_EXCEPTIONS,
): ElementException[] {
  return [];
}

export function maskedIconViewBox(_structural: readonly StructuralException[] = STRUCTURAL_EXCEPTIONS): string | null {
  return null;
}

export function maxDiffPixelsFor(
  _scenario: string,
  _tolerances: readonly ToleranceOverride[] = TOLERANCE_OVERRIDES,
): number {
  return 0;
}
