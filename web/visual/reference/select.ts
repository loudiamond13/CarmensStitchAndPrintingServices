// How a parity page reads its query string (WEB-02, D-33). Shared by the reference entry (this folder) and, in plan
// 02-14, the implementation side, so both select the same cases from the same list:
//   - `theme`: light (the default) or dark; anything else selects nothing, so a typo never passes.
//   - `group`: only scenarios of that group.
//   - `case`: only the scenario with that id. A `frame: 'viewport'` scenario (a fixed-position overlay) renders only when
//     its case is asked for, one case per page load; it never shares a page with other cases.
// A scenario renders only in the themes it declares (public scenarios are light only, D-14). An empty selection makes
// the page show its data-parity-empty marker, which fails the visual spec.
import type { Scenario, Theme } from '../../src/dev/scenarios/types';

export interface Selection {
  /** The theme to render, or null when the `theme` value is not light or dark. */
  readonly theme: Theme | null;
  readonly scenarios: readonly Scenario[];
}

function parseTheme(value: string | null): Theme | null {
  if (value === null || value === 'light') {
    return 'light';
  }
  return value === 'dark' ? 'dark' : null;
}

/** The scenarios a page with this query string renders, in list order. */
export function selectScenarios(all: readonly Scenario[], search: string): Selection {
  const params = new URLSearchParams(search);
  const theme = parseTheme(params.get('theme'));
  if (theme === null) {
    return { theme, scenarios: [] };
  }
  const group = params.get('group');
  const caseId = params.get('case');
  const scenarios = all.filter(
    (scenario) =>
      scenario.themes.includes(theme) &&
      (group === null || scenario.group === group) &&
      (caseId === null ? scenario.frame !== 'viewport' : scenario.id === caseId),
  );
  return { theme, scenarios };
}
