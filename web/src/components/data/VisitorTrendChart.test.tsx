import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { VisitorTrendChart, type TrendPoint } from '@/components/data';
import {
  chartBarClasses,
  chartGridClasses,
  chartLegendClasses,
  chartSvgClasses,
  chartSwatchClasses,
  chartVisitorHaloClasses,
  chartVisitorLineClasses,
  chartVisitorSwatchClasses,
} from './data.recipe';

// The visits trend (UI-SPEC V1 item 4; ANL-08): hand-rolled SVG page-view bars and a unique-visitor line on the
// IncomeExpenseChart geometry. Every figure is the server's; the chart only draws and formats it.

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

function classTokens(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])].sort();
}

/** `YYYY-MM-DD` for the day `offset` days after `start`. */
function dayAfter(start: string, offset: number): string {
  const [year, month, day] = start.split('-').map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + offset)).toISOString().slice(0, 10);
}

/** `count` day buckets from `start`, with figures from `figures`. */
function days(start: string, count: number, figures: (i: number) => [number, number | null]): TrendPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const [pageViews, uniqueVisitors] = figures(i);
    return { start: dayAfter(start, i), pageViews, uniqueVisitors };
  });
}

/** 30 days from Oct 17, 2026: every third day has no page views, the rest grow. */
const THIRTY = days('2026-10-17', 30, (i) => (i % 3 === 0 ? [0, 0] : [i * 2, i]));

function renderThirty() {
  return render(<VisitorTrendChart buckets={THIRTY} bucket="day" from="2026-10-17" to="2026-11-15" />);
}

function plot(): HTMLElement {
  return screen.getByRole('group', { name: 'Page views and unique visitors, Oct 17 to Nov 15, 2026' });
}

function bucketGroups(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[data-bucket]')];
}

describe('VisitorTrendChart: 30 day buckets', () => {
  it('names the plot with the range the server read', () => {
    renderThirty();

    expect(plot().tagName.toLowerCase()).toBe('svg');
    expect(classTokens(plot())).toEqual(tokens(chartSvgClasses));
  });

  it('draws one bucket per day and a page-view bar for each day that has page views', () => {
    const { container } = renderThirty();
    const groups = bucketGroups(container);

    expect(groups).toHaveLength(30);
    const bars = groups.map((group) => group.querySelector('path'));
    expect(bars.every((bar) => classTokens(bar).join(' ') === tokens(chartBarClasses.income).join(' '))).toBe(true);
    expect(bars.filter((bar) => bar?.getAttribute('d') !== '')).toHaveLength(20);
    expect(bars[0]?.getAttribute('d')).toBe('');
  });

  it('draws the unique-visitor line over the bars with its surface halo', () => {
    const { container } = renderThirty();
    const halo = container.querySelector(`path.${tokens(chartVisitorHaloClasses).join('.')}`);
    const line = container.querySelector(`path.${tokens(chartVisitorLineClasses).join('.')}`);

    expect(halo?.getAttribute('d')).toMatch(/^M/);
    expect(line?.getAttribute('d')).toBe(halo?.getAttribute('d'));
    // One point per day with a unique-visitor count.
    expect(container.querySelectorAll('circle')).toHaveLength(30);
  });

  it('draws three gridlines with count ticks up to the largest figure rounded up to one significant digit', () => {
    const { container } = renderThirty();
    const grid = [...container.querySelectorAll('line')].filter(
      (line) => classTokens(line).join(' ') === tokens(chartGridClasses).join(' '),
    );

    expect(grid).toHaveLength(3);
    // The largest figure is 58 page views, so the top is 60.
    expect([...container.querySelectorAll('svg > g:not([data-bucket]) > text')].map((t) => t.textContent)).toEqual([
      '0',
      '30',
      '60',
    ]);
  });

  it('labels the day buckets "Oct 17" and keeps the 220 view box height', () => {
    const { container } = renderThirty();
    const labels = bucketGroups(container).map((group) => group.querySelector('text')?.textContent ?? null);

    expect(labels.filter((label) => label !== null)).toContain('Nov 15');
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 640 220');
  });

  it('shows the legend: a Page views swatch and a Unique visitors line swatch', () => {
    renderThirty();
    const legend = screen.getByText('Page views').parentElement?.parentElement;

    expect(classTokens(legend)).toEqual(tokens(chartLegendClasses));
    const swatches = [...(legend?.querySelectorAll('i') ?? [])];
    expect(swatches.map((swatch) => classTokens(swatch))).toEqual([
      tokens(chartSwatchClasses.income),
      tokens(chartVisitorSwatchClasses),
    ]);
    expect(screen.getByText('Unique visitors')).toBeTruthy();
  });

  it('has no axe violations', async () => {
    const { container } = renderThirty();

    await expectNoAxeViolations(container);
  });
});
