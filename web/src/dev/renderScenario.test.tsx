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

/** The bucket list of a VisitorTrendChart scenario. */
function bucketsOf(id: string): readonly { uniqueVisitors?: unknown }[] {
  const buckets = scenarioById(id).node.props?.buckets;
  return Array.isArray(buckets) ? (buckets as readonly { uniqueVisitors?: unknown }[]) : [];
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
  'visitor-trend-13-month-gap',
  'visitor-stats-cut-note',
  'kpi-visitors-counted-from',
  'kpi-visitors-not-available',
  'stat-bar-list-empty',
  'stat-bar-list-one',
  'stat-bar-list-ten',
  'page-speed-ratings',
  'page-speed-no-layout-shift',
  'page-speed-no-data',
  'page-speed-over-13-months',
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

  it('draws the trend with 30 day bars, 12 month bars, and a line that stops before the 13-month cut', () => {
    expect(idsOf('visitor-stats')).toContain('visitor-trend-30-days');
    const days = renderCase('visitor-trend-30-days').container;
    expect(days.querySelectorAll('[data-bucket]')).toHaveLength(30);
    expect(days.querySelectorAll('circle')).toHaveLength(0);
    cleanup();

    const months = renderCase('visitor-trend-12-months').container;
    expect(months.querySelectorAll('[data-bucket]')).toHaveLength(12);
    cleanup();

    const gap = bucketsOf('visitor-trend-13-month-gap');
    const missing = gap.filter((bucket) => bucket.uniqueVisitors === null).length;
    expect(missing).toBeGreaterThan(0);
    const chart = renderCase('visitor-trend-13-month-gap').container;
    expect(chart.querySelectorAll('[data-bucket]')).toHaveLength(gap.length);
    expect(chart.querySelectorAll('circle')).toHaveLength(0);
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

  it('shows Page speed with each rating, a missing layout shift, no data and an old range', () => {
    expect(idsOf('visitor-stats')).toContain('page-speed-ratings');
    renderCase('page-speed-ratings');
    for (const word of ['Good', 'Needs work', 'Poor']) {
      expect(screen.getByText(word)).toBeInTheDocument();
    }
    cleanup();

    renderCase('page-speed-no-layout-shift');
    expect(screen.getByText('Not measured')).toBeInTheDocument();
    cleanup();

    renderCase('page-speed-no-data');
    expect(screen.getByText('No speed data for these dates yet.')).toBeInTheDocument();
    cleanup();

    renderCase('page-speed-over-13-months');
    expect(screen.getByText('Not available for dates over 13 months ago')).toBeInTheDocument();
  });

  it('shows the KpiCard "Not available" value and the partial count hint', () => {
    expect(idsOf('visitor-stats')).toContain('kpi-visitors-not-available');
    renderCase('kpi-visitors-not-available');
    expect(screen.getByText('Not available')).toBeInTheDocument();
    expect(screen.getByText('Not available for dates over 13 months ago')).toBeInTheDocument();
    cleanup();

    renderCase('kpi-visitors-counted-from');
    expect(screen.getByText('Counted from Oct 15, 2025 only')).toBeInTheDocument();
  });

  it('shows the 13-month Note, the no-visits state, the failed read and the failed refresh', () => {
    expect(idsOf('visitor-stats')).toContain('visitor-stats-cut-note');
    renderCase('visitor-stats-cut-note');
    expect(
      screen.getByText(/^Unique visitors and visits are kept for 13 months\. Before Oct 15, 2025,/),
    ).toBeInTheDocument();
    cleanup();

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
