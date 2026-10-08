// The parity matrix (WEB-02, D-33, UI-SPEC "Look-Equality Proof" → Matrix): which pages each engine loads, at which
// width, theme, interaction state and pass. One row is one Playwright test; parity.spec.ts turns every row into a test.
//   - Every engine: every scenario at 390 and 1440 px, rest and hover (hover only where the scenario lists it).
//   - Chromium only: rest at 320 and 820 for responsive scenarios; focus-visible and active at 390 and 1440; one
//     reduced-motion pass (O-6) and one touch / no-hover pass (D-05) at 390 for the scenarios tagged with them.
//   - Themes: each scenario in the themes it lists (admin and showcase: Blush and Espresso; public: Blush only, D-14).
//   - SPEC-GAP scenarios (`parity: false`) have no reference: they ride along in the rest rows, where the implementation
//     page still runs axe and the guard, and their states are never driven.
// Prop states (disabled, selected, current, invalid, collapsed) are separate scenarios, so they are rows like any other.
import type { Scenario, ScenarioState, Theme } from '../src/dev/scenarios/types.ts';

/** `default`, or one of the two extra passes: reduced motion (O-6) and touch / no hover (D-05). */
export type MatrixPass = 'default' | 'motion' | 'touch';

/** Rows only Chromium runs carry this tag; the Firefox and WebKit projects skip them (grepInvert). */
export const CHROMIUM_ONLY_TAG = '@chromium-only';

/** Widths every engine runs. */
export const SHARED_WIDTHS = Object.freeze([390, 1440]);
/** Extra widths Chromium runs for responsive scenarios (rest only). */
export const RESPONSIVE_WIDTHS = Object.freeze([320, 820]);
/** The width of the reduced-motion and touch passes. */
export const PASS_WIDTH = 390;

const THEMES: readonly Theme[] = ['light', 'dark'];

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

function row(
  group: string,
  theme: Theme,
  width: number,
  state: ScenarioState,
  pass: MatrixPass,
  chromiumOnly: boolean,
  cases: readonly Scenario[],
): MatrixRow {
  const passTag = pass === 'default' ? '' : ` @${pass}`;
  const engineTag = chromiumOnly ? ` ${CHROMIUM_ONLY_TAG}` : '';
  return {
    title: `@parity @${group} ${theme} ${String(width)}px ${state}${passTag}${engineTag}`,
    slug: `${theme}-${String(width)}-${state}-${pass}`,
    group,
    theme,
    width,
    state,
    pass,
    chromiumOnly,
    cases,
  };
}

/** The rows for one group and theme, in a fixed order: rest, the states, then the passes. */
function rowsFor(group: string, theme: Theme, cases: readonly Scenario[]): MatrixRow[] {
  const rows: MatrixRow[] = [];
  const add = (width: number, state: ScenarioState, pass: MatrixPass, chromiumOnly: boolean, list: Scenario[]) => {
    if (list.length > 0) {
      rows.push(row(group, theme, width, state, pass, chromiumOnly, list));
    }
  };
  const parity = cases.filter((scenario) => scenario.parity);
  const withState = (state: ScenarioState) => parity.filter((scenario) => scenario.states.includes(state));

  for (const width of SHARED_WIDTHS) {
    add(width, 'rest', 'default', false, [...cases]);
  }
  for (const width of RESPONSIVE_WIDTHS) {
    add(
      width,
      'rest',
      'default',
      true,
      cases.filter((scenario) => scenario.responsive),
    );
  }
  for (const width of SHARED_WIDTHS) {
    add(width, 'hover', 'default', false, withState('hover'));
  }
  for (const state of ['focus-visible', 'active'] as const) {
    for (const width of SHARED_WIDTHS) {
      add(width, state, 'default', true, withState(state));
    }
  }
  for (const pass of ['motion', 'touch'] as const) {
    add(
      PASS_WIDTH,
      'rest',
      pass,
      true,
      cases.filter((scenario) => scenario.passes?.includes(pass) === true),
    );
  }
  return rows;
}

/** The test timeout of a row with no cases, and the floor of every row (the config's own timeout). */
export const ROW_TIMEOUT_FLOOR_MS = 120_000;
/** What one more case may add to a row: state rows load a page pair per case and run axe on both (plan 02-17). */
export const ROW_TIMEOUT_PER_CASE_MS = 12_000;
/** Fixed cost of a row: the two page fixtures, the first page loads and the font wait. */
const ROW_TIMEOUT_BASE_MS = 60_000;

/**
 * The test timeout of one row. A row's work grows with its case count: with 24 actions cases, Firefox hover rows and
 * WebKit rows at 1440 px ran past a flat 120 s while every comparison still passed (plan 02-17). This is only the
 * ceiling a hung page waits for; it never changes what is compared.
 */
export function rowTimeout(row: Pick<MatrixRow, 'cases'>): number {
  return Math.max(ROW_TIMEOUT_FLOOR_MS, ROW_TIMEOUT_BASE_MS + row.cases.length * ROW_TIMEOUT_PER_CASE_MS);
}

/** Every row of the matrix, grouped by scenario group (in first-appearance order), then by theme. */
export function planMatrix(scenarios: readonly Scenario[]): MatrixRow[] {
  const groups = [...new Set(scenarios.map((scenario) => scenario.group))];
  return groups.flatMap((group) => {
    const inGroup = scenarios.filter((scenario) => scenario.group === group);
    return THEMES.flatMap((theme) =>
      rowsFor(
        group,
        theme,
        inGroup.filter((scenario) => scenario.themes.includes(theme)),
      ),
    );
  });
}
