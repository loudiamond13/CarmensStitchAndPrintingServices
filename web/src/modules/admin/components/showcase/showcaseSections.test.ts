// Which showcase section shows which scenario (D-22).
import { describe, expect, it } from 'vitest';
import { scenarios } from '@/dev/scenarios';
import type { Scenario } from '@/dev/scenarios/types';
import { LAYOUT_GROUPS, SHOWCASE_SECTIONS, scenariosBySection } from './showcaseSections';

function scenario(id: string, group: string): Scenario {
  return {
    id,
    group,
    node: { kind: 'node', component: 'Button' },
    themes: ['light'],
    responsive: false,
    states: ['rest'],
    parity: false,
  };
}

describe('scenariosBySection', () => {
  it('lists the sections in the UI-SPEC order, then Navigation, Marketing and Sign-in and devices', () => {
    expect(SHOWCASE_SECTIONS.map((section) => section.title)).toEqual([
      'Brand & icons',
      'Buttons',
      'Status',
      'Forms',
      'Data',
      'Feedback',
      'Media',
      'Navigation',
      'Marketing',
      'Sign-in and devices',
    ]);
  });

  it('places every scenario of the shared list once, except the whole-page layouts', () => {
    const placed = [...scenariosBySection(scenarios).values()].flat();
    const expected = scenarios.filter((item) => !LAYOUT_GROUPS.includes(item.group));
    expect(placed).toHaveLength(expected.length);
    expect(new Set(placed.map((item) => item.id))).toEqual(new Set(expected.map((item) => item.id)));
  });

  it('takes the groups in the listed order and puts moved scenarios first', () => {
    const bySection = scenariosBySection([
      scenario('media-placeholder-4x3', 'brand'),
      scenario('logo-sm', 'brand'),
      scenario('uploader-empty', 'media'),
      scenario('lazy-image-error', 'states'),
      scenario('error-state-orders', 'states'),
      scenario('toast-info', 'feedback'),
    ]);
    expect(bySection.get('brand')?.map((item) => item.id)).toEqual(['logo-sm']);
    expect(bySection.get('media')?.map((item) => item.id)).toEqual([
      'media-placeholder-4x3',
      'lazy-image-error',
      'uploader-empty',
    ]);
    expect(bySection.get('feedback')?.map((item) => item.id)).toEqual(['toast-info', 'error-state-orders']);
  });

  it('throws on a scenario group no section takes, so a new group file has to be placed', () => {
    expect(() => scenariosBySection([scenario('x', 'gadgets')])).toThrow(
      'No showcase section takes the scenario group "gadgets".',
    );
  });
});
