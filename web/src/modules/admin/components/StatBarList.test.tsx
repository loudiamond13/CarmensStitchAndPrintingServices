import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatBarList } from '@/modules/admin/components/StatBarList';
import type { RankedItem } from '@/modules/admin/services/visitorStatsService';

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
