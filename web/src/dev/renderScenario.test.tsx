import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { kit as appKit } from './kit';
import { renderNode, type Kit } from './renderScenario';
import { scenarioById, scenarios } from './scenarios';
import type { ScenarioNode } from './scenarios/types';

afterEach(cleanup);

// A test kit: tiny stand-ins for the real components, so renderNode is checked on its own.
function TestButton({ children }: { children?: ReactNode }) {
  return <button type="button">{children}</button>;
}

function Card({ title, children }: { title?: ReactNode; children?: ReactNode }) {
  return (
    <section aria-label="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Probe({ label, onPick }: { label?: string; onPick?: unknown }) {
  return <output aria-label={label}>{typeof onPick}</output>;
}

const kit: Kit = { Button: TestButton, Card, Probe };

function node(component: string, props?: ScenarioNode['props']): ScenarioNode {
  return props === undefined ? { kind: 'node', component } : { kind: 'node', component, props };
}

describe('renderNode', () => {
  it('renders the button-primary-md scenario as exactly one button saying "Save Order"', () => {
    render(renderNode(kit, scenarioById('button-primary-md').node, []));
    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toBe('Save Order');
  });

  it('turns nested ScenarioNode prop values, alone or in arrays, into elements', () => {
    const tree = node('Card', {
      title: node('Probe', { label: 'in-title' }),
      children: [node('Button', { children: 'One' }), node('Button', { children: 'Two' })],
    });
    render(renderNode(kit, tree, []));
    const card = screen.queryByRole('region', { name: 'card' });
    expect(card?.querySelector('h2 output')?.getAttribute('aria-label')).toBe('in-title');
    expect(screen.queryAllByRole('button').map((button) => button.textContent)).toEqual(['One', 'Two']);
  });

  it('gives every prop named in handlers a function, in nested nodes too, and leaves other props alone', () => {
    const tree = node('Card', {
      title: node('Probe', { label: 'nested' }),
      children: node('Probe', { label: 'child' }),
    });
    render(renderNode(kit, tree, ['onPick']));
    expect(screen.queryByRole('status', { name: 'nested' })?.textContent).toBe('function');
    expect(screen.queryByRole('status', { name: 'child' })?.textContent).toBe('function');

    cleanup();
    render(renderNode(kit, node('Probe', { label: 'plain' }), []));
    expect(screen.queryByRole('status', { name: 'plain' })?.textContent).toBe('undefined');
  });

  it('renders a visible alert for a component the kit does not have', () => {
    render(renderNode(kit, node('Nope'), []));
    expect(screen.queryByRole('alert')?.textContent).toBe('Missing component: Nope');
  });
});

/** Renders a scenario with the real kit, as the showcase does, inside a router for the public links. */
function renderCase(id: string) {
  const scenario = scenarioById(id);
  return render(<MemoryRouter>{renderNode(appKit, scenario.node, scenario.handlers ?? [])}</MemoryRouter>);
}

function idsOf(group: string): string[] {
  return scenarios.filter((scenario) => scenario.group === group).map((scenario) => scenario.id);
}

/** The field names of every bucket of a VisitorTrendChart scenario, sorted, as one text per bucket. */
function bucketFields(id: string): string[] {
  const buckets = scenarioById(id).node.props?.buckets;
  return Array.isArray(buckets) ? buckets.map((bucket: object) => Object.keys(bucket).sort().join(',')) : [];
}

const requests: string[] = [];
let fetchSpy: MockInstance<typeof fetch>;

beforeEach(() => {
  requests.length = 0;
  server.events.on('request:start', ({ request }) => {
    requests.push(request.url);
  });
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  server.events.removeAllListeners();
  fetchSpy.mockRestore();
});

// Axe runs over every case: a busy machine needs more than the 5 s default.
vi.setConfig({ testTimeout: 30_000 });

const VISITOR_STATS_CASES = [
  'visitor-trend-30-days',
  'visitor-trend-12-months',
  'stat-bar-list-empty',
  'stat-bar-list-one',
  'stat-bar-list-ten',
  'visitor-stats-no-visits',
  'visitor-stats-load-error',
  'visitor-stats-stale',
];

describe('the Visitor Stats scenarios (plan 12-29)', () => {
  it('lists every Visitor Stats state in the visitor-stats group, in both themes, as SPEC-GAP cases', () => {
    expect(idsOf('visitor-stats').length).toBe(VISITOR_STATS_CASES.length);
    expect(idsOf('visitor-stats')).toEqual(VISITOR_STATS_CASES);
    for (const id of VISITOR_STATS_CASES) {
      const scenario = scenarioById(id);
      expect(scenario.themes, id).toEqual(['light', 'dark']);
      expect(scenario.parity, id).toBe(false);
    }
  });

  it.each(VISITOR_STATS_CASES)('%s renders with no axe findings and sends nothing', async (id) => {
    expect(idsOf('visitor-stats')).toContain(id);
    const { container } = renderCase(id);
    expect(container.textContent).not.toContain('Missing component');
    await expectNoAxeViolations(container);
    expect(requests).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('draws the trend with 30 day bars and 12 month bars, page views only', () => {
    expect(idsOf('visitor-stats')).toContain('visitor-trend-30-days');
    const days = renderCase('visitor-trend-30-days').container;
    expect(days.querySelectorAll('[data-bucket]')).toHaveLength(30);
    expect(days.querySelectorAll('circle')).toHaveLength(0);
    expect([...new Set(bucketFields('visitor-trend-30-days'))]).toEqual(['pageViews,start']);
    cleanup();

    const months = renderCase('visitor-trend-12-months').container;
    expect(months.querySelectorAll('[data-bucket]')).toHaveLength(12);
    expect([...new Set(bucketFields('visitor-trend-12-months'))]).toEqual(['pageViews,start']);
  });

  it('shows StatBarList with no rows, one row and ten rows', () => {
    expect(idsOf('visitor-stats')).toContain('stat-bar-list-empty');
    renderCase('stat-bar-list-empty');
    expect(screen.getByText('No visitors allowed visitor stats in these dates.')).toBeInTheDocument();
    cleanup();

    renderCase('stat-bar-list-one');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    cleanup();

    renderCase('stat-bar-list-ten');
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
  });

  it('shows the no-visits state, the failed read and the failed refresh', () => {
    expect(idsOf('visitor-stats')).toContain('visitor-stats-no-visits');
    renderCase('visitor-stats-no-visits');
    expect(screen.getByRole('heading', { level: 2, name: 'No visits in these dates' })).toBeInTheDocument();
    cleanup();

    renderCase('visitor-stats-load-error');
    expect(screen.getByText("Couldn't load the visitor stats.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    cleanup();

    renderCase('visitor-stats-stale');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe("Showing figures from 9:41 AM. Couldn't refresh.");
    expect(within(alert.parentElement ?? alert).getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });
});

const LEGAL_CASES = ['legal-notice'];

describe('the legal scenarios (plan 12-29, D-54)', () => {
  it('lists only the DRAFT notice in the legal group, Blush only, and no consent group', () => {
    expect(idsOf('legal')).toEqual(LEGAL_CASES);
    expect(idsOf('consent')).toEqual([]);
    for (const id of LEGAL_CASES) {
      const scenario = scenarioById(id);
      expect(scenario.themes, id).toEqual(['light']);
      expect(scenario.parity, id).toBe(false);
      expect(scenario.frame, id).toBeUndefined();
    }
  });

  it('names no cookie bar or Cookie Settings preview in any scenario', () => {
    const named = scenarios.map((scenario) => scenario.node.component);
    expect(named.filter((name) => name === 'StaticConsentBar' || name === 'OpenedCookieSettings')).toEqual([]);
  });

  it.each(LEGAL_CASES)('%s settles with no axe findings and sends nothing', async (id) => {
    const { container } = renderCase(id);
    expect(container.textContent).not.toContain('Missing component');
    expect((await screen.findAllByText('Draft: this text is not final yet.')).length).toBeGreaterThan(0);
    await expectNoAxeViolations(container);
    expect(requests).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
