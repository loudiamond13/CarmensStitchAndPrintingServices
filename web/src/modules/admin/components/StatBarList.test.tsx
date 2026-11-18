import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatBarList } from '@/modules/admin/components/StatBarList';
import type { RankedItem } from '@/modules/admin/services/visitorStatsService';
import { expectNoAxeViolations } from '@/test/axe';

// StatBarList (UI-SPEC V1 items 5 to 7; ANL-08, D-28): a ranked list with the server's counts and shares. The browser only formats.

const PAGES: RankedItem[] = [
  { name: 'gallery', count: 412, share: 38 },
  { name: 'home', count: 1234, share: 62 },
];

const EMPTY = 'No visitors allowed visitor stats in these dates.';

function rows(): HTMLElement[] {
  return within(screen.getByRole('list')).getAllByRole('listitem');
}

function fill(row: HTMLElement): HTMLElement {
  const bar = row.querySelector<HTMLElement>('[style]');
  if (bar === null) throw new Error('No bar fill');
  return bar;
}

describe('StatBarList: rows', () => {
  it('is an ordered list with one row per item in the order the server sent', () => {
    render(<StatBarList items={PAGES} emptyText={EMPTY} />);

    expect(screen.getByRole('list').tagName).toBe('OL');
    expect(rows().map((row) => row.querySelector('[data-stat-name]')?.textContent)).toEqual(['gallery', 'home']);
  });

  it('shows each count with en-PH grouping and the server share as "412 · 38%"', () => {
    const { container } = render(<StatBarList items={PAGES} emptyText={EMPTY} />);

    const figures = [...container.querySelectorAll('li [data-stat-figure]')].map((figure) => figure.textContent);
    expect(figures).toHaveLength(2);
    expect(figures).toEqual(['412 · 38%', '1,234 · 62%']);
  });

  it('fills each bar to the server share through --bar-w, with the track hidden from assistive technology', () => {
    render(<StatBarList items={PAGES} emptyText={EMPTY} />);

    const first = rows()[0] ?? document.body;
    expect(fill(first).style.getPropertyValue('--bar-w')).toBe('38%');
    expect(fill(rows()[1] ?? document.body).style.getPropertyValue('--bar-w')).toBe('62%');
    expect(fill(first).parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(fill(first).className.split(/\s+/)).toEqual(expect.arrayContaining(['w-(--bar-w)', 'bg-chart-expense']));
  });

  it('shows each name through labelFor when one is given', () => {
    render(<StatBarList items={PAGES} emptyText={EMPTY} labelFor={(name) => name.toUpperCase()} />);

    expect(screen.getByText('GALLERY')).toBeInTheDocument();
    expect(screen.getByText('HOME')).toBeInTheDocument();
  });
});

describe('StatBarList: empty, one and long rows', () => {
  it('shows the empty line and no list when there are no rows', () => {
    render(<StatBarList items={[]} emptyText={EMPTY} />);

    expect(screen.getByText(EMPTY)).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('draws one row as a full bar at 100%', () => {
    render(<StatBarList items={[{ name: 'Facebook', count: 1, share: 100 }]} emptyText={EMPTY} />);

    expect(rows()).toHaveLength(1);
    expect(screen.getByText('1 · 100%')).toBeInTheDocument();
    expect(fill(rows()[0] ?? document.body).style.getPropertyValue('--bar-w')).toBe('100%');
  });

  it('shows up to 10 rows as the server sent them', () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ name: `host-${String(i)}.example`, count: 10 - i, share: 10 }));
    render(<StatBarList items={ten} emptyText={EMPTY} />);

    expect(rows()).toHaveLength(10);
  });

  it('wraps a 200-character host anywhere and keeps its figure whole on its own line', () => {
    const host = `${'a'.repeat(196)}.com`;
    expect(host).toHaveLength(200);
    render(<StatBarList items={[{ name: host, count: 3, share: 100 }]} emptyText={EMPTY} />);

    const name = screen.getByText(host);
    const figure = screen.getByText('3 · 100%');
    expect(name.className.split(/\s+/)).toEqual(expect.arrayContaining(['wrap-anywhere', 'min-w-0']));
    expect(figure.className.split(/\s+/)).toContain('whitespace-nowrap');
    expect(name).not.toContainElement(figure);
    expect(name.parentElement?.className.split(/\s+/)).toContain('flex-wrap');
  });

  it('shows a referrer host as plain text, never as a link', () => {
    render(<StatBarList items={[{ name: 'basketball-league.ph', count: 2, share: 100 }]} emptyText={EMPTY} />);

    expect(screen.getByText('basketball-league.ph').closest('a')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it.each(['light', 'dark'])('has no axe violations in the %s theme', async (theme) => {
    const { container } = render(
      <div data-theme={theme}>
        <StatBarList items={PAGES} emptyText={EMPTY} />
        <StatBarList items={[]} emptyText={EMPTY} />
      </div>,
    );

    await expectNoAxeViolations(container);
  });
});
