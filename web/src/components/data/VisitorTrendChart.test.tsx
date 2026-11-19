import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { VisitorTrendChart, type TrendPoint } from '@/components/data';
import {
  chartBarClasses,
  chartGridClasses,
  chartLegendClasses,
  chartSvgClasses,
  chartSwatchClasses,
  chartTipClasses,
} from './data.recipe';

// The page views trend (UI-SPEC V1 item 4; ANL-08, D-68): hand-rolled SVG page-view bars on the IncomeExpenseChart geometry.
// Every figure is the server's; the chart only draws and formats it.

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

/** `count` day buckets from `start`, with page views from `figures`. */
function days(start: string, count: number, figures: (i: number) => number): TrendPoint[] {
  return Array.from({ length: count }, (_, i) => ({ start: dayAfter(start, i), pageViews: figures(i) }));
}

/** 30 days from Oct 17, 2026: every third day has no page views, the rest grow. */
const THIRTY = days('2026-10-17', 30, (i) => (i % 3 === 0 ? 0 : i * 2));

function renderThirty() {
  return render(<VisitorTrendChart buckets={THIRTY} bucket="day" from="2026-10-17" to="2026-11-15" />);
}

function plot(): HTMLElement {
  return screen.getByRole('group', { name: 'Page views, Oct 17 to Nov 15, 2026' });
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

  it('draws page view bars only: no line, no points and no unique visitor swatch or tooltip row', async () => {
    const user = userEvent.setup();
    const { container } = renderThirty();
    await user.tab();

    expect(container.querySelectorAll('path')).toHaveLength(30);
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    expect(container.querySelectorAll('svg > g[aria-hidden="true"]')).toHaveLength(0);
    expect(container.querySelectorAll('i')).toHaveLength(2);
    expect(container.textContent).not.toMatch(/unique visitors:|Unique visitors \d/i);
  });

  it('ignores a unique visitor figure left in the data: no line, no points', () => {
    const stale = THIRTY.map((point) => ({ ...point, uniqueVisitors: 7 }));
    const { container } = render(<VisitorTrendChart buckets={stale} bucket="day" from="2026-10-17" to="2026-11-15" />);

    expect(container.querySelectorAll('circle')).toHaveLength(0);
    expect(container.querySelectorAll('path')).toHaveLength(30);
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

  it('shows the legend: a Page views swatch and nothing else', () => {
    renderThirty();
    const legend = screen.getByText('Page views').parentElement;

    expect(classTokens(legend)).toEqual(tokens(chartLegendClasses));
    const swatches = [...(legend?.querySelectorAll('i') ?? [])];
    expect(swatches.map((swatch) => classTokens(swatch))).toEqual([tokens(chartSwatchClasses.income)]);
    expect(screen.queryByText('Unique visitors')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = renderThirty();

    await expectNoAxeViolations(container);
  });
});

/** `count` month buckets from the first of `year`-`month`, with page views from `figures`. */
function months(year: number, month: number, count: number, figures: (i: number) => number): TrendPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    start: new Date(Date.UTC(year, month - 1 + i, 1)).toISOString().slice(0, 10),
    pageViews: figures(i),
  }));
}

/** Dec 2025 to Nov 2026, page views every month. */
const TWELVE = months(2025, 12, 12, (i) => 100 + i * 10);

/** A ResizeObserver stand-in: the test reports the frame width. */
function stubResizeObserver() {
  let callback: ResizeObserverCallback | undefined;
  class StubResizeObserver {
    constructor(onResize: ResizeObserverCallback) {
      callback = onResize;
    }
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
  return {
    resize(width: number) {
      act(() => {
        callback?.([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
      });
    },
  };
}

/** The labels drawn under the buckets, in order (null where a label is thinned out). */
function bucketLabels(container: HTMLElement): (string | null)[] {
  return bucketGroups(container).map((group) => group.querySelector('text')?.textContent ?? null);
}

describe('VisitorTrendChart: month buckets', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('labels month buckets with the short month', () => {
    const { container } = render(
      <VisitorTrendChart buckets={TWELVE} bucket="month" from="2025-12-01" to="2026-11-30" />,
    );

    expect(bucketLabels(container)).toEqual([
      'Dec',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
    ]);
    expect(screen.getByRole('group').getAttribute('aria-label')).toBe('Page views, Dec 1, 2025 to Nov 30, 2026');
  });

  it('draws a bar for every month that has page views, with no line over them', () => {
    const buckets = months(2023, 10, 6, () => 50);
    const { container } = render(
      <VisitorTrendChart buckets={buckets} bucket="month" from="2023-10-01" to="2024-03-31" />,
    );

    expect(container.querySelectorAll('circle')).toHaveLength(0);
    expect(bucketGroups(container).map((group) => group.querySelector('path')?.getAttribute('d') !== '')).toEqual(
      Array.from({ length: 6 }, () => true),
    );
    expect(container.querySelectorAll('path')).toHaveLength(6);
  });

  it('keeps every month label when a group is 28px or wider', () => {
    const observer = stubResizeObserver();
    const { container } = render(
      <VisitorTrendChart buckets={TWELVE} bucket="month" from="2025-12-01" to="2026-11-30" />,
    );

    observer.resize(640);

    expect(bucketLabels(container).every((label) => label !== null)).toBe(true);
  });

  it('thins the month labels to every other one, counting back from the last, when a group is under 28px', () => {
    const observer = stubResizeObserver();
    const { container } = render(
      <VisitorTrendChart buckets={TWELVE} bucket="month" from="2025-12-01" to="2026-11-30" />,
    );

    observer.resize(320);

    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 320 220');
    expect(bucketLabels(container)).toEqual([
      null,
      'Jan',
      null,
      'Mar',
      null,
      'May',
      null,
      'Jul',
      null,
      'Sep',
      null,
      'Nov',
    ]);
  });

  it('thins the wider day labels further so they never overlap', () => {
    const observer = stubResizeObserver();
    const { container } = renderThirty();

    observer.resize(640);

    // (640 - 52) / 30 is 19.6px a day; a day label needs 44px, so every third one shows, counting back from Nov 15.
    const labels = bucketLabels(container);
    expect(labels.filter((label) => label !== null)).toHaveLength(10);
    expect(labels.at(-1)).toBe('Nov 15');
    expect(labels.at(-2)).toBeNull();
    expect(labels.at(-4)).toBe('Nov 12');
  });
});

/** The open tooltip card, found by its date heading. */
function tooltip(date: string): HTMLElement | null {
  return screen.queryByText(date, { selector: 'strong' })?.parentElement ?? null;
}

function openTip(date: string): HTMLElement {
  const tip = tooltip(date);
  if (tip === null) throw new Error(`No tooltip for ${date}.`);
  return tip;
}

/** The tooltip's rows, each as its text. */
function tipRows(tip: HTMLElement): string[] {
  return [...tip.children].map((row) => row.textContent);
}

/** The polite live text that reads the active bucket. */
function announcement(container: HTMLElement): string | null | undefined {
  return container.querySelector('[aria-live="polite"]')?.textContent;
}

describe('VisitorTrendChart: keyboard and tooltip (SPEC-DEVIATION A11Y-CHART)', () => {
  it('is one tab stop: the plot, not each bucket', async () => {
    const user = userEvent.setup();
    const { container } = renderThirty();

    expect(container.querySelectorAll('[tabindex]')).toHaveLength(1);
    await user.tab();
    expect(plot()).toHaveFocus();
    await user.tab();
    expect(plot()).not.toHaveFocus();
  });

  it('shows the first bucket on focus: the full date and the page views', async () => {
    const user = userEvent.setup();
    renderThirty();

    await user.tab();

    expect(tipRows(openTip('Oct 17, 2026'))).toEqual(['Oct 17, 2026', 'Page views 0']);
  });

  it('moves with Left and Right, and Home and End jump to the ends', async () => {
    const user = userEvent.setup();
    renderThirty();
    await user.tab();

    await user.keyboard('{ArrowRight}');
    expect(tipRows(openTip('Oct 18, 2026'))).toEqual(['Oct 18, 2026', 'Page views 2']);
    await user.keyboard('{ArrowRight}{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(tooltip('Oct 17, 2026')).not.toBeNull();
    await user.keyboard('{End}');
    expect(tipRows(openTip('Nov 15, 2026'))).toEqual(['Nov 15, 2026', 'Page views 58']);
    await user.keyboard('{ArrowRight}');
    expect(tooltip('Nov 15, 2026')).not.toBeNull();
    await user.keyboard('{Home}');
    expect(tooltip('Oct 17, 2026')).not.toBeNull();
    expect(tooltip('Nov 15, 2026')).toBeNull();
  });

  it('hides the tooltip on Escape and shows it again on the next arrow key', async () => {
    const user = userEvent.setup();
    renderThirty();
    await user.tab();

    await user.keyboard('{Escape}');
    expect(tooltip('Oct 17, 2026')).toBeNull();
    expect(plot()).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tooltip('Oct 18, 2026')).not.toBeNull();
  });

  it('hides the tooltip when the plot loses focus', async () => {
    const user = userEvent.setup();
    renderThirty();
    await user.tab();

    await user.tab();

    expect(tooltip('Oct 17, 2026')).toBeNull();
  });

  it('announces each bucket as its tooltip text', async () => {
    const user = userEvent.setup();
    const { container } = renderThirty();
    await user.tab();
    await user.keyboard('{ArrowRight}');

    expect(announcement(container)).toBe(tipRows(openTip('Oct 18, 2026')).join(', '));
    expect(announcement(container)).toBe('Oct 18, 2026, Page views 2');
  });

  it('names a month bucket by its month and year and groups a large count', async () => {
    const user = userEvent.setup();
    const buckets = months(2023, 10, 3, (i) => 1200 + i);
    const { container } = render(
      <VisitorTrendChart buckets={buckets} bucket="month" from="2023-10-01" to="2023-12-31" />,
    );

    await user.tab();

    expect(tipRows(openTip('Oct 2023'))).toEqual(['Oct 2023', 'Page views 1,200']);
    expect(announcement(container)).toBe('Oct 2023, Page views 1,200');
  });

  it('shows the tooltip over the hovered bucket at its centre and hides it when the pointer leaves', () => {
    const { container } = renderThirty();
    const [, second] = bucketGroups(container);
    if (second === undefined) throw new Error('No second bucket');

    fireEvent.mouseEnter(second);

    const tip = openTip('Oct 18, 2026');
    expect(classTokens(tip)).toEqual(tokens(chartTipClasses));
    // The second of 30 buckets over (640 - 52) / 30: (52 + 19.6 * 1.5) / 640.
    expect(Number.parseFloat(tip.style.getPropertyValue('--tip-x'))).toBeCloseTo(((52 + 19.6 * 1.5) / 640) * 100, 6);
    expect(announcement(container)).toBe('');
    fireEvent.mouseLeave(plot());
    expect(tooltip('Oct 18, 2026')).toBeNull();
  });

  it('has no axe violations with the tooltip open from the keyboard', async () => {
    const user = userEvent.setup();
    const { container } = renderThirty();
    await user.tab();
    await user.keyboard('{ArrowRight}');

    await expectNoAxeViolations(container);
  });
});
