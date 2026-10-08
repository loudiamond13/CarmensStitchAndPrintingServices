// @vitest-environment node
// Pins how a parity page reads its query string (WEB-02, D-33): `theme`, `group` and `case` select scenarios from the
// shared 02-38 list; `frame: 'viewport'` cases render one per page load; a mistyped or empty filter selects nothing, so
// the page shows its data-parity-empty marker and the run fails instead of passing vacuously.
import { describe, expect, it } from 'vitest';
import type { Scenario, ScenarioFrame, Theme } from '../../src/dev/scenarios/types';
import { selectScenarios } from './select';

function scenario(id: string, group: string, themes: readonly Theme[], frame?: ScenarioFrame): Scenario {
  return {
    id,
    group,
    node: { kind: 'node', component: 'Button', props: { children: id } },
    themes,
    responsive: false,
    states: ['rest'],
    parity: true,
    ...(frame === undefined ? {} : { frame }),
  };
}

const list: readonly Scenario[] = [
  scenario('button-primary-md', 'actions', ['light', 'dark']),
  scenario('button-ghost-sm', 'actions', ['light', 'dark']),
  scenario('site-header', 'layouts', ['light']),
  scenario('modal-center', 'overlays', ['light', 'dark'], 'viewport'),
];

const ids = (search: string): readonly string[] => selectScenarios(list, search).scenarios.map((item) => item.id);

describe('selectScenarios', () => {
  it('renders every block scenario in the light theme when there is no filter', () => {
    const selection = selectScenarios(list, '');

    expect(selection.theme).toBe('light');
    expect(selection.scenarios.map((item) => item.id)).toEqual(['button-primary-md', 'button-ghost-sm', 'site-header']);
  });

  it('selects one case by id', () => {
    expect(ids('?case=button-primary-md&theme=light')).toEqual(['button-primary-md']);
  });

  it('selects a group, in list order', () => {
    expect(ids('?group=actions')).toEqual(['button-primary-md', 'button-ghost-sm']);
  });

  it('renders the dark theme only for scenarios that declare it (public scenarios are light only, D-14)', () => {
    const selection = selectScenarios(list, '?theme=dark');

    expect(selection.theme).toBe('dark');
    expect(selection.scenarios.map((item) => item.id)).toEqual(['button-primary-md', 'button-ghost-sm']);
    expect(ids('?case=site-header&theme=dark')).toEqual([]);
  });

  it('renders a viewport-frame scenario only when its case is asked for, one per page load', () => {
    expect(ids('?group=overlays')).toEqual([]);
    expect(ids('?case=modal-center&theme=dark')).toEqual(['modal-center']);
  });

  it('selects nothing for an unknown case, an unknown group or an empty filter value', () => {
    expect(ids('?case=does-not-exist')).toEqual([]);
    expect(ids('?group=action')).toEqual([]);
    expect(ids('?case=')).toEqual([]);
    expect(ids('?case=button-primary-md&group=layouts')).toEqual([]);
  });

  it('selects nothing for a theme that is not light or dark, so a typo never passes', () => {
    const selection = selectScenarios(list, '?theme=Dark');

    expect(selection.theme).toBeNull();
    expect(selection.scenarios).toEqual([]);
  });
});
