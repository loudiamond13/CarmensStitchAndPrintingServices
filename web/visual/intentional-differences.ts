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

/** A decision ID as the planning documents write them: D-27, D-31, D-BL-02, O-6, WEB-09, PERF-05, A11Y-04. */
const DECISION_ID = /^(?:D-(?:BL-)?\d+|O-\d+|[A-Z][A-Z0-9]*-\d+)$/;

/**
 * Throws a plain Error naming the first entry that has no decision ID, no reason, a duplicate key, a negative or
 * non-integer pixel count, or (for element exceptions) equal tags. The parity suite runs it at load.
 */
export function assertRegistry(
  structural: readonly StructuralException[] = STRUCTURAL_EXCEPTIONS,
  tolerances: readonly ToleranceOverride[] = TOLERANCE_OVERRIDES,
): void {
  const seen = new Set<string>();
  const check = (key: string, decision: string, reason: string): void => {
    if (!DECISION_ID.test(decision)) {
      throw new Error(`Intentional difference ${key} needs an owner decision ID (got "${decision}").`);
    }
    if (reason.trim() === '') {
      throw new Error(`Intentional difference ${key} needs a reason the owner can read.`);
    }
    if (seen.has(key)) {
      throw new Error(`Intentional difference ${key} is listed more than once.`);
    }
    seen.add(key);
  };
  for (const entry of structural) {
    if (entry.kind === 'element') {
      if (entry.reference === entry.impl) {
        throw new Error(`Element exception ${entry.scenario} ${entry.path} lists the same tag on both sides.`);
      }
      check(`element ${entry.scenario} ${entry.path}`, entry.decision, entry.reason);
    } else {
      check(`icon-drawing ${entry.viewBox}`, entry.decision, entry.reason);
    }
  }
  for (const entry of tolerances) {
    if (!Number.isInteger(entry.maxDiffPixels) || entry.maxDiffPixels < 0) {
      throw new Error(`Tolerance override ${entry.scenario} needs a whole, non-negative pixel count.`);
    }
    check(`tolerance ${entry.scenario}`, entry.decision, entry.reason);
  }
}

/** The element exceptions of one scenario. */
export function elementExceptionsFor(
  scenario: string,
  structural: readonly StructuralException[] = STRUCTURAL_EXCEPTIONS,
): ElementException[] {
  return structural.filter(
    (entry): entry is ElementException => entry.kind === 'element' && entry.scenario === scenario,
  );
}

/** The icon wrapper viewBox whose drawing is masked (D-32), or null when the registry masks no drawing. */
export function maskedIconViewBox(structural: readonly StructuralException[] = STRUCTURAL_EXCEPTIONS): string | null {
  const mask = structural.find((entry): entry is DrawingMask => entry.kind === 'icon-drawing');
  return mask?.viewBox ?? null;
}

/** The pixel tolerance for one scenario: 0 unless an override with an owner decision says otherwise. */
export function maxDiffPixelsFor(
  scenario: string,
  tolerances: readonly ToleranceOverride[] = TOLERANCE_OVERRIDES,
): number {
  return tolerances.find((entry) => entry.scenario === scenario)?.maxDiffPixels ?? 0;
}
