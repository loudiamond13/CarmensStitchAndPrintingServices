// The Contact hours card and the open status (PUB-05, CONT-04, D-21, D-22; UI-SPEC C1 HoursCard): the words come from the
// server's facts, the rows from the weekly hours. No test here reads the device clock to choose a word.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import {
  answerOpenStatus,
  demoSite,
  openStatusAt0859,
  openStatusAt0900,
  openStatusAt1759,
  openStatusAt1800,
  sundayClosed,
  type OpenStatusFixture,
} from '@/test/publicFixtures';
import { statusLine } from '../copy';
import { HoursCard } from './HoursCard';

function renderCard() {
  return render(<HoursCard site={demoSite} />);
}

const MONDAY = { date: '2026-11-16', day: 1, opensAt: '09:00', when: 'weekday' };
const SATURDAY = { date: '2026-11-21', day: 6, opensAt: '09:00', when: 'weekday' };

describe('statusLine (D-22)', () => {
  const cases: readonly (readonly [string, OpenStatusFixture, string | null])[] = [
    ['open until the closing time', openStatusAt0900, 'Closes 6:00 PM.'],
    ['open one minute before closing', openStatusAt1759, 'Closes 6:00 PM.'],
    ['closed, opening today', openStatusAt0859, 'Opens today 9:00 AM.'],
    ['closed, opening tomorrow', openStatusAt1800, 'Opens tomorrow 9:00 AM.'],
    ['closed, opening on a named weekday', sundayClosed, 'Opens Monday 9:00 AM.'],
    [
      'closed today for a closure with a note',
      { ...openStatusAt1800, closedToday: true, todayClosureNote: 'Christmas', nextOpening: MONDAY },
      'Closed today for Christmas. Opens Monday 9:00 AM.',
    ],
    [
      'closed today for a closure with no note',
      { ...openStatusAt1800, closedToday: true, nextOpening: SATURDAY },
      'Closed today. Opens Saturday 9:00 AM.',
    ],
    ['closed with no opening in 14 days', { ...openStatusAt1800, nextOpening: null }, null],
    [
      'closed today with no opening in 14 days',
      { ...openStatusAt1800, closedToday: true, todayClosureNote: 'Christmas', nextOpening: null },
      'Closed today for Christmas.',
    ],
  ];

  it.each(cases)('%s', (_name, status, expected) => {
    expect(statusLine(status)).toBe(expected);
  });
});

describe('HoursCard: the open status (PUB-05, D-22)', () => {
  it('open: the "Open now" pill and "Closes 6:00 PM."', async () => {
    answerOpenStatus(openStatusAt0900);
    renderCard();

    expect(await screen.findByText('Open now')).toBeInTheDocument();
    expect(screen.getByText('Closes 6:00 PM.')).toBeInTheDocument();
    expect(screen.queryByText('Closed now')).not.toBeInTheDocument();
  });

  it('closed after 6:00 PM: "Closed now" and "Opens tomorrow 9:00 AM."', async () => {
    answerOpenStatus(openStatusAt1800);
    renderCard();

    expect(await screen.findByText('Closed now')).toBeInTheDocument();
    expect(screen.getByText('Opens tomorrow 9:00 AM.')).toBeInTheDocument();
    expect(screen.queryByText('Open now')).not.toBeInTheDocument();
  });

  it('closed before 9:00 AM: "Opens today 9:00 AM."', async () => {
    answerOpenStatus(openStatusAt0859);
    renderCard();

    expect(await screen.findByText('Opens today 9:00 AM.')).toBeInTheDocument();
  });

  it('closed on a Sunday: "Opens Monday 9:00 AM."', async () => {
    answerOpenStatus(sundayClosed);
    renderCard();

    expect(await screen.findByText('Opens Monday 9:00 AM.')).toBeInTheDocument();
  });

  it('follows the server and not the device clock', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-15T03:00:00+08:00') });
    try {
      answerOpenStatus(openStatusAt0900);
      renderCard();

      expect(await screen.findByText('Open now')).toBeInTheDocument();
      expect(screen.getByText('Closes 6:00 PM.')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('HoursCard: the rows (D-21)', () => {
  it('shows the title as an h2 and the grouped rows, Monday first, with Sunday as Closed', async () => {
    answerOpenStatus(openStatusAt0900);
    renderCard();

    expect(await screen.findByRole('heading', { level: 2, name: 'Business hours' })).toBeInTheDocument();
    const terms = screen.getAllByRole('term').map((term) => term.textContent);
    const definitions = screen.getAllByRole('definition').map((definition) => definition.textContent);
    expect(terms).toEqual(['Monday to Saturday', 'Sunday']);
    expect(definitions).toEqual(['9:00 AM - 6:00 PM', 'Closed']);
  });

  it('shows the rows before the status has loaded', () => {
    renderCard();

    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(['Monday to Saturday', 'Sunday']);
  });

  it('has no axe violations', async () => {
    answerOpenStatus(openStatusAt0900);
    const { container } = renderCard();
    await screen.findByText('Open now');

    await expectNoAxeViolations(container);
  });

  it('puts the pill in the head row beside the title', async () => {
    answerOpenStatus(openStatusAt0900);
    renderCard();
    await screen.findByText('Open now');

    const heading = screen.getByRole('heading', { level: 2, name: 'Business hours' });
    expect(within(heading.parentElement as HTMLElement).getByText('Open now')).toBeInTheDocument();
  });
});
