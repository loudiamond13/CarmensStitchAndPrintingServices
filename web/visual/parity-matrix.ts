// The parity matrix (WEB-02, D-33, UI-SPEC "Look-Equality Proof" → Matrix): which pages each engine loads, at which
// width, theme, interaction state and pass. RED stub (plan 02-14 Task 2).
import type { Scenario, ScenarioState, Theme } from '../src/dev/scenarios/types.ts';

/** `default`, or one of the two extra passes: reduced motion (O-6) and touch / no hover (D-05). */
export type MatrixPass = 'default' | 'motion' | 'touch';

/** Rows only Chromium runs carry this tag; the Firefox and WebKit projects skip them (grepInvert). */
export const CHROMIUM_ONLY_TAG = '@chromium-only';

export interface MatrixRow {
  /** The test title: `@parity @<group> <theme> <width>px <state>`, plus the pass tag and `@chromium-only`. */
  readonly title: string;
  /** File-name-safe slug for the screenshots: `<theme>-<width>-<state>-<pass>`. */
  readonly slug: string;
  readonly group: string;
  readonly theme: Theme;
  readonly width: number;
  readonly state: ScenarioState;
  readonly pass: MatrixPass;
  readonly chromiumOnly: boolean;
  /** In list order. Cases with `parity: false` (SPEC-GAP) are only checked by axe and the guard. */
  readonly cases: readonly Scenario[];
}

export function planMatrix(_scenarios: readonly Scenario[]): MatrixRow[] {
  return [];
}
