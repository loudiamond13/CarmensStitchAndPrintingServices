import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { kit } from '@/dev/kit';
import { renderNode } from '@/dev/renderScenario';
import { CHART_12_MONTHS, CHART_6_MONTHS, scenarios as dataScenarios } from '@/dev/scenarios/groups/data';
import { expectNoAxeViolations } from '@/test/axe';
import { IncomeExpenseChart, type ChartDatum } from '@/components/data';
import {
  chartAxisClasses,
  chartBarClasses,
  chartClasses,
  chartGridClasses,
  chartHoverClasses,
  chartLegendClasses,
  chartNetClasses,
  chartProfitHaloClasses,
  chartProfitLineClasses,
  chartProfitLossClasses,
  chartProfitPointClasses,
  chartProfitSwatchClasses,
  chartSvgClasses,
  chartSwatchClasses,
  chartTickClasses,
  chartTipClasses,
  chartZeroLineClasses,
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

/** The first month group; throws when there is none. */
function firstMonth(): HTMLElement {
  const [first] = months();
  if (first === undefined) throw new Error('No month group.');
  return first;
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

  it('draws thirteen months that repeat a short month name, each its own group, with no React key warning (UI-WR-13)', () => {
    const THIRTEEN: ChartDatum[] = [{ month: 'Oct', label: 'Oct 2025', income: 1000, expenses: 500 }, ...TWELVE];
    const { rerender } = render(<IncomeExpenseChart data={THIRTEEN} />);
    expect(months()).toHaveLength(13);
    expect(months().filter((month) => month.getAttribute('aria-label')?.startsWith('Oct '))).toHaveLength(2);

    // Without labels the short names repeat outright; the groups still keep their own identity.
    rerender(
      <IncomeExpenseChart data={THIRTEEN.map(({ month, income, expenses }) => ({ month, income, expenses }))} />,
    );
    expect(months()).toHaveLength(13);
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

// The server's profit per month for the six-month series (D-36): the figures the API sends, never worked out here.
const SERVER_PROFIT = [37200, 62300, 20820, 71780, 43080, 68130];
const SIX_WITH_PROFIT: ChartDatum[] = SIX.map((datum, index) => ({ ...datum, profit: SERVER_PROFIT[index] ?? 0 }));
const OCT_PROFIT_NAME = `${OCT_NAME}, profit ₱68,130.00`;

/** The aria-hidden group that holds the profit halo, line and points. */
function profitDrawing(container: HTMLElement): SVGGElement | null {
  return container.querySelector('svg g[aria-hidden="true"]');
}

/** The elements of the profit drawing that carry exactly this class list. */
function profitParts(container: HTMLElement, selector: string, classes: string): Element[] {
  const wanted = tokens(classes).join(' ');
  return [...(profitDrawing(container)?.querySelectorAll(selector) ?? [])].filter(
    (element) => classTokens(element).join(' ') === wanted,
  );
}

/** The plot's y for a figure, with the default 220 height and an axis top of ₱200,000 (App. D.3 `y`). */
function yAt(value: number): number {
  return 12 + 180 * (1 - value / 200000);
}

describe('IncomeExpenseChart profit line (D-36, D-50)', () => {
  it('draws the server profit as a halo, a line and one point per month', () => {
    const { container } = render(<IncomeExpenseChart data={SIX_WITH_PROFIT} showProfit />);
    const xs = [101, 199, 297, 395, 493, 591];
    const expected = `M${SERVER_PROFIT.map((value, index) => `${String(xs[index])},${String(yAt(value))}`).join('L')}`;

    const halo = profitParts(container, 'path', chartProfitHaloClasses);
    const line = profitParts(container, 'path', chartProfitLineClasses.above);
    const points = profitParts(container, 'circle', chartProfitPointClasses.above);

    expect(halo).toHaveLength(1);
    expect(halo[0]?.getAttribute('d')).toBe(expected);
    expect(line).toHaveLength(1);
    expect(line[0]?.getAttribute('d')).toBe(expected);
    expect(points).toHaveLength(6);
    expect(points.map((point) => point.getAttribute('cx'))).toEqual(xs.map(String));
    expect(points.map((point) => point.getAttribute('cy'))).toEqual(SERVER_PROFIT.map((value) => String(yAt(value))));
    expect(points.every((point) => point.getAttribute('r') === '3.5')).toBe(true);
  });

  it('draws the halo before the line, and keeps the profit drawing out of the accessibility tree', () => {
    const { container } = render(<IncomeExpenseChart data={SIX_WITH_PROFIT} showProfit />);
    const group = profitDrawing(container);
    const [first, second] = [...(group?.querySelectorAll('path') ?? [])];

    expect(classTokens(first)).toEqual(tokens(chartProfitHaloClasses));
    expect(classTokens(second)).toEqual(tokens(chartProfitLineClasses.above));
    expect(group?.getAttribute('aria-hidden')).toBe('true');
    expect(within(drawing()).getAllByRole('img')).toHaveLength(6);
  });

  it('grows the point of the hovered month to radius 5', () => {
    const { container } = render(<IncomeExpenseChart data={SIX_WITH_PROFIT} showProfit />);

    fireEvent.focus(screen.getByRole('img', { name: OCT_PROFIT_NAME }));
    const radii = profitParts(container, 'circle', chartProfitPointClasses.above).map((point) =>
      point.getAttribute('r'),
    );

    expect(radii).toEqual(['3.5', '3.5', '3.5', '3.5', '3.5', '5']);
  });

  it('names each month group with the server profit', () => {
    render(<IncomeExpenseChart data={SIX_WITH_PROFIT} showProfit />);

    expect(months().map((group) => group.getAttribute('aria-label'))).toEqual([
      'May 2026: income ₱98,400.00, expenses ₱61,200.00, profit ₱37,200.00',
      'Jun 2026: income ₱132,650.00, expenses ₱70,350.00, profit ₱62,300.00',
      'Jul 2026: income ₱87,300.00, expenses ₱66,480.00, profit ₱20,820.00',
      'Aug 2026: income ₱145,900.00, expenses ₱74,120.00, profit ₱71,780.00',
      'Sep 2026: income ₱112,980.00, expenses ₱69,900.00, profit ₱43,080.00',
      OCT_PROFIT_NAME,
    ]);
  });

  it('shows a profit key with a line swatch in the legend when showProfit is on', () => {
    render(<IncomeExpenseChart data={SIX_WITH_PROFIT} showProfit />);
    const legend = screen.getByText('Income (payments)').parentElement;
    const key = within(legend ?? document.body).getByText('Profit');

    expect(classTokens(key.querySelector('i'))).toEqual(tokens(chartProfitSwatchClasses));
    expect(classTokens(legend)).toEqual(tokens(chartLegendClasses));
  });

  it('shows the profit row from the server figure and no Net row in the tooltip', () => {
    render(<IncomeExpenseChart data={SIX_WITH_PROFIT} showProfit />);

    fireEvent.focus(screen.getByRole('img', { name: OCT_PROFIT_NAME }));
    const tip = openTip('Oct');

    expect(within(tip).getByText('Profit ₱68,130.00')).toBeTruthy();
    expect(within(tip).getByText('Income ₱126,450.00')).toBeTruthy();
    expect(within(tip).queryByText(/^Net/)).toBeNull();
  });

  it('draws the profit the server sent even when it differs from income minus expenses', () => {
    render(
      <IncomeExpenseChart
        data={[{ month: 'Jan', label: 'Jan 2026', income: 1000, expenses: 250, profit: 999 }]}
        showProfit
      />,
    );

    expect(months()[0]?.getAttribute('aria-label')).toBe(
      'Jan 2026: income ₱1,000.00, expenses ₱250.00, profit ₱999.00',
    );
    fireEvent.focus(firstMonth());
    expect(screen.getByText('Profit ₱999.00')).toBeTruthy();
  });

  it('draws no profit point or figure for a month the server sent without a profit', () => {
    const { container } = render(
      <IncomeExpenseChart data={[{ month: 'Jan', label: 'Jan 2026', income: 1000, expenses: 250 }]} showProfit />,
    );

    expect(profitParts(container, 'circle', chartProfitPointClasses.above)).toHaveLength(0);
    expect(months()[0]?.getAttribute('aria-label')).toBe('Jan 2026: income ₱1,000.00, expenses ₱250.00');
    fireEvent.focus(firstMonth());
    expect(within(openTip('Jan')).queryByText(/^Profit/)).toBeNull();
    expect(within(openTip('Jan')).queryByText(/^Net/)).toBeNull();
  });

  it('draws no profit line, key or name, and keeps the Net row, without showProfit even when profit is given', () => {
    const { container } = render(<IncomeExpenseChart data={SIX_WITH_PROFIT} />);

    expect(profitDrawing(container)).toBeNull();
    expect(screen.queryByText('Profit')).toBeNull();
    expect(months().map((group) => group.getAttribute('aria-label'))).toContain(OCT_NAME);
    fireEvent.focus(screen.getByRole('img', { name: OCT_NAME }));
    expect(within(openTip('Oct')).getByText('Net ₱68,130.00')).toBeTruthy();
  });

  it('replaces the legend and tooltip words with the labels prop', () => {
    const labels = { income: 'Money in', expenses: 'Money out', profit: 'Gain', net: 'Left' };
    const { rerender } = render(<IncomeExpenseChart data={SIX_WITH_PROFIT} showProfit labels={labels} />);

    expect(screen.getByText('Money in')).toBeTruthy();
    expect(screen.getByText('Money out')).toBeTruthy();
    expect(screen.getByText('Gain')).toBeTruthy();
    fireEvent.focus(screen.getByRole('img', { name: OCT_PROFIT_NAME }));
    expect(within(openTip('Oct')).getByText('Gain ₱68,130.00')).toBeTruthy();

    rerender(<IncomeExpenseChart data={SIX_WITH_PROFIT} labels={labels} />);
    expect(within(openTip('Oct')).getByText('Left ₱68,130.00')).toBeTruthy();
  });
});

// A month with negative income (refunds over payments) beside a month with negative profit (D-36, UI-SPEC D3). The
// top is ₱80,000 and the lowest figure is −₱12,000, so the axis bottom is −₱20,000 (the top's ₱10,000 step).
const LOSS_MONTHS: ChartDatum[] = [
  { month: 'Aug', label: 'Aug 2026', income: 80000, expenses: 60000, profit: 20000 },
  { month: 'Sep', label: 'Sep 2026', income: -5000, expenses: 0, profit: -5000 },
  { month: 'Oct', label: 'Oct 2026', income: 40000, expenses: 52000, profit: -12000 },
];
const MINUS = '−';

function lines(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('line')];
}

function textsOf(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll('text')].map((text) => text.textContent);
}

/** Every number in a path's d attribute, in order. */
function numbersIn(path: Element | undefined): number[] {
  return (path?.getAttribute('d') ?? '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
}

describe('IncomeExpenseChart below zero (D-36)', () => {
  it('runs the axis from the lowest figure rounded down to the top step, with ticks at the bottom, zero, half and top', () => {
    const { container } = render(<IncomeExpenseChart data={LOSS_MONTHS} showProfit />);

    expect(textsOf(container)).toEqual([`${MINUS}₱20k`, '₱0', '₱40k', '₱80k', 'Aug', 'Sep', 'Oct']);
    const grid = lines(container).filter((line) => classTokens(line).join(' ') === tokens(chartGridClasses).join(' '));
    expect(grid.map((line) => Number(line.getAttribute('y1')))).toEqual([192, 156, 84, 12]);
  });

  it('draws the zero line in the axis look, once, at the zero tick', () => {
    const { container } = render(<IncomeExpenseChart data={LOSS_MONTHS} showProfit />);
    const zero = lines(container).filter(
      (line) => classTokens(line).join(' ') === tokens(chartZeroLineClasses).join(' '),
    );

    expect(tokens(chartZeroLineClasses)).toEqual(tokens(chartAxisClasses));
    expect(zero).toHaveLength(1);
    expect(Number(zero[0]?.getAttribute('y1'))).toBe(156);
  });

  it('grows a below-zero income bar down from the zero line with rounded corners at the bottom', () => {
    const { container } = render(<IncomeExpenseChart data={LOSS_MONTHS} showProfit />);
    const bars = [...container.querySelectorAll('svg > g[role="img"] > path')];
    // Sep is the second group: income first, then expenses (no bar for a zero figure).
    const sepIncome = bars.find((bar) => numbersIn(bar)[0] === 327);

    expect(classTokens(sepIncome)).toEqual(tokens(chartBarClasses.income));
    expect(sepIncome?.getAttribute('d')).toMatch(/^M327,156H345V161Q345,165 341,165H331Q327,165 327,161Z$/);
  });

  it('keeps expense bars and positive income bars rising from the zero line', () => {
    const { container } = render(<IncomeExpenseChart data={LOSS_MONTHS} showProfit />);
    const [augIncome, augExpense] = [...container.querySelectorAll('svg > g[role="img"] > path')];

    expect(numbersIn(augIncome)[1]).toBe(156);
    expect(numbersIn(augExpense)[1]).toBe(156);
  });

  it('writes a below-zero tick with the U+2212 minus, also below one thousand', () => {
    const { container } = render(<IncomeExpenseChart data={[{ month: 'Jan', income: -500, expenses: 300 }]} />);

    expect(textsOf(container)).toContain(`${MINUS}₱500`);
    expect(textsOf(container).join('')).not.toContain('-₱');
  });

  it('reads income below zero for the scale without showProfit, and profit only with it', () => {
    const profitOnly: ChartDatum[] = [{ month: 'Jan', income: 10000, expenses: 40000, profit: -30000 }];
    const { container, rerender } = render(<IncomeExpenseChart data={profitOnly} />);
    expect(textsOf(container).slice(0, 3)).toEqual(['₱0', '₱20k', '₱40k']);

    rerender(<IncomeExpenseChart data={profitOnly} showProfit />);
    expect(textsOf(container)[0]).toBe(`${MINUS}₱30k`);
  });

  it('keeps the scale and ticks as today when nothing is below zero, with and without showProfit', () => {
    const { container, rerender } = render(<IncomeExpenseChart data={SIX_WITH_PROFIT} showProfit />);
    expect(textsOf(container).slice(0, 3)).toEqual(['₱0', '₱100k', '₱200k']);
    expect(
      lines(container).filter((line) => classTokens(line).join(' ') === tokens(chartAxisClasses).join(' ')),
    ).toHaveLength(1);

    rerender(<IncomeExpenseChart data={SIX_WITH_PROFIT} />);
    expect(textsOf(container).slice(0, 3)).toEqual(['₱0', '₱100k', '₱200k']);
  });

  it('splits the profit line at zero with two clipPaths whose ids come from useId, dashing the below-zero copy', () => {
    const { container } = render(<IncomeExpenseChart data={LOSS_MONTHS} showProfit />);
    const clips = [...container.querySelectorAll('clipPath')];
    const [above, below] = [
      profitParts(container, 'path', chartProfitLineClasses.above)[0],
      profitParts(container, 'path', chartProfitLineClasses.below)[0],
    ];

    expect(clips).toHaveLength(2);
    expect(clips.map((clip) => clip.id)).not.toContain('');
    expect(new Set(clips.map((clip) => clip.id)).size).toBe(2);
    expect(above?.getAttribute('clip-path')).toBe(`url(#${clips[0]?.id ?? ''})`);
    expect(below?.getAttribute('clip-path')).toBe(`url(#${clips[1]?.id ?? ''})`);
    expect(above?.getAttribute('stroke-dasharray')).toBeNull();
    expect(below?.getAttribute('stroke-dasharray')).toBe('4 3');
    // The above clip covers the plot down to the zero line (y 156), the below clip from there to the bottom.
    expect(clips[0]?.querySelector('rect')?.getAttribute('height')).toBe('156');
    expect(clips[1]?.querySelector('rect')?.getAttribute('y')).toBe('156');
  });

  it('gives each chart on the page its own clip ids', () => {
    const { container } = render(
      <>
        <IncomeExpenseChart data={LOSS_MONTHS} showProfit />
        <IncomeExpenseChart data={LOSS_MONTHS} showProfit />
      </>,
    );
    const ids = [...container.querySelectorAll('clipPath')].map((clip) => clip.id);

    expect(new Set(ids).size).toBe(4);
  });

  it('colors each point by its side of zero', () => {
    const { container } = render(<IncomeExpenseChart data={LOSS_MONTHS} showProfit />);
    const aboveOnes = profitParts(container, 'circle', chartProfitPointClasses.above);
    const belowOnes = profitParts(container, 'circle', chartProfitPointClasses.below);

    expect(aboveOnes.map((point) => point.getAttribute('cx'))).toEqual(['150']);
    expect(belowOnes.map((point) => point.getAttribute('cx'))).toEqual(['346', '542']);
  });

  it('names a negative profit month with the U+2212 minus', () => {
    render(<IncomeExpenseChart data={LOSS_MONTHS} showProfit />);

    expect(months().map((group) => group.getAttribute('aria-label'))).toEqual([
      'Aug 2026: income ₱80,000.00, expenses ₱60,000.00, profit ₱20,000.00',
      `Sep 2026: income ${MINUS}₱5,000.00, expenses ₱0.00, profit ${MINUS}₱5,000.00`,
      `Oct 2026: income ₱40,000.00, expenses ₱52,000.00, profit ${MINUS}₱12,000.00`,
    ]);
  });

  it('shows a below-zero profit in the tooltip in the danger color', () => {
    render(<IncomeExpenseChart data={LOSS_MONTHS} showProfit />);

    fireEvent.focus(screen.getByRole('img', { name: /^Oct 2026/ }));
    const figure = within(openTip('Oct')).getByText(`${MINUS}₱12,000.00`, { selector: 'span span' });

    expect(classTokens(figure)).toEqual(tokens(chartProfitLossClasses));
    expect(openTip('Oct').textContent).toContain(`Profit ${MINUS}₱12,000.00`);
  });
});

/** A ResizeObserver stand-in: the test reports the frame width, and sees whether the chart disconnects. */
function stubResizeObserver() {
  const disconnect = vi.fn();
  let callback: ResizeObserverCallback | undefined;
  class StubResizeObserver {
    constructor(onResize: ResizeObserverCallback) {
      callback = onResize;
    }
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = disconnect;
  }
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
  return {
    disconnect,
    resize(width: number) {
      act(() => {
        callback?.([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
      });
    },
  };
}

/** The month labels drawn under the bars, in order. */
function monthLabels(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll('svg > g[role="img"] > text')].map((text) => text.textContent);
}

function viewBox(container: HTMLElement): string | null | undefined {
  return container.querySelector('svg')?.getAttribute('viewBox');
}

describe('IncomeExpenseChart true-pixel width (D-51)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('draws a 640 wide view box until the frame is measured, and without ResizeObserver', () => {
    const { container } = render(<IncomeExpenseChart data={SIX} />);

    expect(typeof ResizeObserver).toBe('undefined');
    expect(viewBox(container)).toBe('0 0 640 220');
  });

  it('uses the measured frame width as the view box width and follows a resize', () => {
    const observer = stubResizeObserver();
    const { container } = render(<IncomeExpenseChart data={SIX} />);

    observer.resize(320);
    expect(viewBox(container)).toBe('0 0 320 220');

    observer.resize(900);
    expect(viewBox(container)).toBe('0 0 900 220');
  });

  it('keeps 640 when the frame reports no width', () => {
    const observer = stubResizeObserver();
    const { container } = render(<IncomeExpenseChart data={SIX} />);

    observer.resize(0);

    expect(viewBox(container)).toBe('0 0 640 220');
  });

  it('spreads the groups and positions the tooltip over the measured width', () => {
    const observer = stubResizeObserver();
    const { container } = render(<IncomeExpenseChart data={SIX} />);

    observer.resize(320);
    fireEvent.focus(screen.getByRole('img', { name: OCT_NAME }));

    // Oct is the sixth of six columns over (320 - 52) / 6: (52 + 44.666... * 5 + 22.33...) / 320.
    const style = openTip('Oct').style;
    expect(Number.parseFloat(style.getPropertyValue('--tip-x'))).toBeCloseTo(((52 + (268 / 6) * 5.5) / 320) * 100, 6);
    expect(container.querySelector('line')?.getAttribute('x2')).toBe('320');
  });

  it('draws every other month label, counting back from the last, when a group is narrower than 28px', () => {
    const observer = stubResizeObserver();
    const { container } = render(<IncomeExpenseChart data={TWELVE} />);

    observer.resize(320);

    expect(monthLabels(container)).toEqual(['Dec', 'Feb', 'Apr', 'Jun', 'Aug', 'Oct']);
    expect(months()).toHaveLength(12);
    expect(months().every((group) => (group.getAttribute('aria-label') ?? '').includes(': income '))).toBe(true);
    expect(months()[0]?.getAttribute('aria-label')).toBe('Nov 2025: income ₱76,500.00, expenses ₱52,100.00');
  });

  it('draws every month label for six months at 320, and at exactly 28px per group', () => {
    const observer = stubResizeObserver();
    const { container } = render(<IncomeExpenseChart data={SIX} />);

    observer.resize(320);
    expect(monthLabels(container)).toEqual(['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);

    const { container: twelve } = render(<IncomeExpenseChart data={TWELVE} />);
    observer.resize(52 + 28 * 12);
    expect(monthLabels(twelve)).toHaveLength(12);
  });

  it('keeps the last month labelled when the count is odd', () => {
    const observer = stubResizeObserver();
    const THIRTEEN: ChartDatum[] = [{ month: 'Oct', label: 'Oct 2025', income: 1000, expenses: 500 }, ...TWELVE];
    const { container } = render(<IncomeExpenseChart data={THIRTEEN} />);

    observer.resize(320);

    expect(monthLabels(container).at(-1)).toBe('Oct');
    expect(monthLabels(container)).toHaveLength(7);
  });

  it('disconnects the observer when the chart unmounts', () => {
    const observer = stubResizeObserver();
    const { unmount } = render(<IncomeExpenseChart data={SIX} />);

    expect(observer.disconnect).not.toHaveBeenCalled();
    unmount();

    expect(observer.disconnect).toHaveBeenCalledTimes(1);
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
