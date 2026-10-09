import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { CHART_12_MONTHS, CHART_6_MONTHS, scenarios as dataScenarios } from '@/dev/scenarios/groups/data';
import { expectNoAxeViolations } from '@/test/axe';
import { IncomeExpenseChart, type ChartDatum } from '@/ui/data';
import {
  chartAxisClasses,
  chartBarClasses,
  chartClasses,
  chartGridClasses,
  chartHoverClasses,
  chartLegendClasses,
  chartNetClasses,
  chartSvgClasses,
  chartSwatchClasses,
  chartTickClasses,
  chartTipClasses,
} from './data.recipe';

// The converted App. D.3 IncomeExpenseChart (plan 02-24, CSPS-UI-SPEC.md §6.4, §8.3, §12.4): hand-rolled SVG bars, the
// custom-property tooltip and keyboard-reachable month groups. The look at rest is proven by the parity suite
// (`--grep @data`); these tests pin the drawing, the names, the tooltip and the scenario set.

const SIX = CHART_6_MONTHS as unknown as ChartDatum[];
const TWELVE = CHART_12_MONTHS as unknown as ChartDatum[];

const OCT_NAME = 'Oct 2026: income ₱126,450.00, expenses ₱58,320.00';

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean).sort();
}

function classTokens(element: Element | null | undefined): string[] {
  return [...(element?.classList ?? [])].sort();
}

function renderSix() {
  return render(<IncomeExpenseChart data={SIX} />);
}

/** The chart drawing: an SVG group named for the whole chart. */
function drawing(): HTMLElement {
  return screen.getByRole('group', { name: 'Monthly income versus expenses' });
}

/** The month groups: one keyboard-reachable image per month. */
function months(): HTMLElement[] {
  return within(drawing()).getAllByRole('img');
}

/** The open tooltip card for a month; throws when it is not shown. */
function openTip(month: string): HTMLElement {
  const tip = tooltip(month);
  if (tip === null) throw new Error(`No tooltip for ${month}.`);
  return tip;
}

/** The tooltip card, found by its month heading. */
function tooltip(month: string): HTMLElement | null {
  return screen.queryByText(month, { selector: 'strong' })?.parentElement ?? null;
}

describe('IncomeExpenseChart (App. D.3)', () => {
  it('draws one month group per data point, each named with the month and both peso figures', () => {
    renderSix();
    const groups = months();

    expect(groups).toHaveLength(6);
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'May 2026: income ₱98,400.00, expenses ₱61,200.00',
      'Jun 2026: income ₱132,650.00, expenses ₱70,350.00',
      'Jul 2026: income ₱87,300.00, expenses ₱66,480.00',
      'Aug 2026: income ₱145,900.00, expenses ₱74,120.00',
      'Sep 2026: income ₱112,980.00, expenses ₱69,900.00',
      OCT_NAME,
    ]);
  });

  it('makes every month group keyboard-focusable', () => {
    renderSix();

    for (const group of months()) {
      expect(group.getAttribute('tabindex')).toBe('0');
    }
  });

  it('falls back to the short month for the name when a datum has no label', () => {
    render(<IncomeExpenseChart data={[{ month: 'Oct', income: 1000, expenses: 250.5 }]} />);

    expect(months()[0]?.getAttribute('aria-label')).toBe('Oct: income ₱1,000.00, expenses ₱250.50');
  });

  it('draws twelve month groups for twelve months', () => {
    render(<IncomeExpenseChart data={TWELVE} />);

    expect(months()).toHaveLength(12);
    expect(months()[0]?.getAttribute('aria-label')).toBe('Nov 2025: income ₱76,500.00, expenses ₱52,100.00');
  });

  it('reads the axis top from the largest figure rounded up to one significant digit: ₱0, ₱100k, ₱200k', () => {
    const { container } = renderSix();
    const ticks = [...container.querySelectorAll('text')].map((text) => text.textContent);

    expect(ticks.slice(0, 3)).toEqual(['₱0', '₱100k', '₱200k']);
    expect(ticks.slice(3)).toEqual(['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
  });

  it('writes ticks below ₱1,000 in full', () => {
    const { container } = render(<IncomeExpenseChart data={[]} />);
    const ticks = [...container.querySelectorAll('text')].map((text) => text.textContent);

    expect(ticks).toEqual(['₱0', '₱0.5', '₱1']);
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });

  it('draws the App. D.3 geometry: a 640 × 220 view box, 3 gridlines, the axis, and income/expense bars', () => {
    const { container } = renderSix();
    const svg = container.querySelector('svg');
    const lines = [...container.querySelectorAll('line')];
    const bars = [...container.querySelectorAll('path')];

    expect(svg?.getAttribute('viewBox')).toBe('0 0 640 220');
    expect(lines.slice(0, 3).map((line) => line.getAttribute('y1'))).toEqual(['192', '102', '12']);
    expect(lines.slice(0, 3).every((line) => classTokens(line).join(' ') === tokens(chartGridClasses).join(' '))).toBe(
      true,
    );
    expect(classTokens(lines[3])).toEqual(tokens(chartAxisClasses));
    expect(lines[3]?.getAttribute('y1')).toBe('192');
    expect(bars).toHaveLength(12);
    expect(classTokens(bars[0])).toEqual(tokens(chartBarClasses.income));
    expect(classTokens(bars[1])).toEqual(tokens(chartBarClasses.expense));
    // May income ₱98,400 of ₱200,000: x = 52 + 98/2 − 18 − 1 = 82, top = 12 + 180 × (1 − 0.492) = 103.44, rounded top.
    expect(bars[0]?.getAttribute('d')).toBe('M82,192V107.44Q82,103.44 86,103.44H96Q100,103.44 100,107.44V192Z');
  });

  it('draws no bar for a zero figure', () => {
    const { container } = render(<IncomeExpenseChart data={[{ month: 'Jan', income: 500, expenses: 0 }]} />);
    const [income, expense] = [...container.querySelectorAll('path')];

    expect(income?.getAttribute('d')).not.toBe('');
    expect(expense?.getAttribute('d')).toBe('');
  });

  it('shows the legend: Income (payments) and Expenses (company + orders), with their swatches', () => {
    const { container } = renderSix();
    const legend = screen.getByText('Income (payments)').parentElement;

    expect(classTokens(container.firstElementChild)).toEqual(tokens(chartClasses));
    expect(classTokens(legend)).toEqual(tokens(chartLegendClasses));
    expect(within(legend ?? document.body).getByText('Expenses (company + orders)')).toBeTruthy();
    const swatches = [...(legend?.querySelectorAll('i') ?? [])];
    expect(swatches.map((swatch) => classTokens(swatch))).toEqual([
      tokens(chartSwatchClasses.income),
      tokens(chartSwatchClasses.expense),
    ]);
    expect(classTokens(container.querySelector('svg'))).toEqual(tokens(chartSvgClasses));
    expect(classTokens(container.querySelector('text'))).toEqual(tokens(chartTickClasses));
  });

  it('shows no tooltip and no highlight at rest', () => {
    const { container } = renderSix();

    expect(tooltip('Oct')).toBeNull();
    expect(container.querySelector('rect[rx]')).toBeNull();
  });

  it('shows the tooltip with the same figures when a month group takes focus, positioned only through --tip-x', () => {
    const { container } = renderSix();
    const october = screen.getByRole('img', { name: OCT_NAME });

    fireEvent.focus(october);
    const tip = tooltip('Oct');

    expect(tip).not.toBeNull();
    expect(classTokens(tip)).toEqual(tokens(chartTipClasses));
    expect(within(openTip('Oct')).getByText('Income ₱126,450.00')).toBeTruthy();
    expect(within(openTip('Oct')).getByText('Expenses ₱58,320.00')).toBeTruthy();
    const net = within(openTip('Oct')).getByText('Net ₱68,130.00');
    expect(classTokens(net)).toEqual(tokens(chartNetClasses));
    const style = openTip('Oct').style;
    expect(Array.from({ length: style.length }, (_, index) => style.item(index))).toEqual(['--tip-x']);
    // Oct is the sixth column: (52 + 98 × 5 + 49) / 640 = 92.34375%.
    expect(style.getPropertyValue('--tip-x')).toBe('92.34375%');
    const highlight = container.querySelector('rect[rx]');
    expect(classTokens(highlight)).toEqual(tokens(chartHoverClasses));
    expect(highlight?.getAttribute('x')).toBe(String(52 + 98 * 5 + 4));
  });

  it('hides the tooltip when the month group loses focus', () => {
    renderSix();
    const october = screen.getByRole('img', { name: OCT_NAME });

    fireEvent.focus(october);
    fireEvent.blur(october);

    expect(tooltip('Oct')).toBeNull();
  });

  it('dismisses the tooltip with Escape while the month keeps focus (WCAG 1.4.13)', () => {
    renderSix();
    const october = screen.getByRole('img', { name: OCT_NAME });

    fireEvent.focus(october);
    fireEvent.keyDown(october, { key: 'Enter' });
    expect(tooltip('Oct')).not.toBeNull();
    fireEvent.keyDown(october, { key: 'Escape' });

    expect(tooltip('Oct')).toBeNull();
  });

  it('shows the tooltip on hover and hides it when the pointer leaves the drawing', () => {
    renderSix();
    const may = screen.getByRole('img', { name: /^May 2026/ });

    fireEvent.mouseEnter(may);
    expect(within(openTip('May')).getByText('Net ₱37,200.00')).toBeTruthy();

    fireEvent.mouseLeave(drawing());
    expect(tooltip('May')).toBeNull();
  });

  it('writes a negative net with the U+2212 minus', () => {
    render(<IncomeExpenseChart data={[{ month: 'Jan', label: 'Jan 2026', income: 1000, expenses: 1500 }]} />);

    fireEvent.focus(screen.getByRole('img', { name: /^Jan 2026/ }));

    expect(screen.getByText('Net −₱500.00')).toBeTruthy();
  });

  it('scales the drawing height with the height prop', () => {
    const { container } = render(<IncomeExpenseChart data={SIX} height={300} />);

    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 640 300');
  });

  it('has no axe violations at rest and with the tooltip open', async () => {
    const { container } = renderSix();
    await expectNoAxeViolations(container);

    fireEvent.focus(screen.getByRole('img', { name: OCT_NAME }));
    await expectNoAxeViolations(container);
  });

  it('re-renders from the React Compiler memo cache with the same output, and updates on new props', () => {
    const { container, rerender } = renderSix();
    const first = container.innerHTML;

    rerender(<IncomeExpenseChart data={SIX} />);
    expect(container.innerHTML).toBe(first);

    rerender(<IncomeExpenseChart data={TWELVE} />);
    expect(months()).toHaveLength(12);

    rerender(<IncomeExpenseChart data={TWELVE} height={300} />);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 640 300');
  });
});

describe('data scenarios (the chart cases)', () => {
  it('declares the chart with the spec §12.4 six months and with twelve months, at rest in both themes', () => {
    const charts = dataScenarios.filter((scenario) => scenario.node.component === 'IncomeExpenseChart');

    expect(charts.map((scenario) => scenario.id)).toEqual(['chart-6-months', 'chart-12-months']);
    for (const chart of charts) {
      expect(chart.states, chart.id).toEqual(['rest']);
      expect(chart.themes, chart.id).toEqual(['light', 'dark']);
    }
    expect(CHART_6_MONTHS.map((datum) => [datum.month, datum.income, datum.expenses])).toEqual([
      ['May', 98400, 61200],
      ['Jun', 132650, 70350],
      ['Jul', 87300, 66480],
      ['Aug', 145900, 74120],
      ['Sep', 112980, 69900],
      ['Oct', 126450, 58320],
    ]);
    expect(CHART_12_MONTHS.slice(6)).toEqual(CHART_6_MONTHS);
    expect(Math.max(...CHART_12_MONTHS.map((datum) => Math.max(Number(datum.income), Number(datum.expenses))))).toBe(
      145900,
    );
  });

  it('renders the 6-month case through the implementation kit with six named month groups', () => {
    const scenario = dataScenarios.find((candidate) => candidate.id === 'chart-6-months');
    if (scenario === undefined) throw new Error('chart-6-months is missing');
    render(renderNode(kit, scenario.node, scenario.handlers ?? []));

    expect(months()).toHaveLength(6);
  });
});
