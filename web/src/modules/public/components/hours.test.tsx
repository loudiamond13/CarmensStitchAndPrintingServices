// The Contact hours card and the open status (PUB-05, CONT-04, D-21, D-22; UI-SPEC C1 HoursCard): the words come from the
// server's facts, the rows from the weekly hours. No test here reads the device clock to choose a word.
import { render, screen, waitFor } from '@testing-library/react';
import { delay, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import {
  answerOpenStatus,
  closedWeek,
  closureToday,
  demoSite,
  mixedWeek,
  openStatusAt0859,
  openStatusAt0900,
  openStatusAt1759,
  openStatusAt1800,
  openStatusFailureHandler,
  sundayClosed,
  type OpenStatusFixture,
  type PublicSiteFixture,
} from '@/test/publicFixtures';
import { statusLine } from '../hoursCopy';
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
    expect(heading.nextElementSibling).toHaveTextContent('Open now');
  });
});

function renderFor(site: PublicSiteFixture | undefined) {
  return render(<HoursCard site={site} />);
}

const CLOSURES: PublicSiteFixture['upcomingClosures'] = [
  { firstDay: '2026-12-25', lastDay: '2026-12-25', note: 'Christmas' },
  { firstDay: '2026-12-30', lastDay: '2027-01-01', note: 'Year-end inventory' },
  { firstDay: '2027-01-05', lastDay: '2027-01-05', note: null },
];

const PILL_SKELETON = '[style*="--sk-w: 84px"]';

describe('HoursCard: closures (CONT-04, D-21)', () => {
  it('on a closure day shows "Closed now" and the closure note with the next opening', async () => {
    answerOpenStatus(closureToday);
    renderCard();

    expect(await screen.findByText('Closed now')).toBeInTheDocument();
    expect(screen.getByText('Closed today for Christmas. Opens Saturday 9:00 AM.')).toBeInTheDocument();
  });

  it('on a closure day with no note says "Closed today." and the next opening', async () => {
    answerOpenStatus({ ...closureToday, todayClosureNote: null });
    renderCard();

    expect(await screen.findByText('Closed today. Opens Saturday 9:00 AM.')).toBeInTheDocument();
  });

  it('leaves out the Opens part when there is no opening in 14 days', async () => {
    answerOpenStatus({ ...closureToday, nextOpening: null });
    renderCard();

    expect(await screen.findByText('Closed today for Christmas.')).toBeInTheDocument();
  });

  it('lists the coming closures under "Closed on", a range with "to" and no note left out', async () => {
    answerOpenStatus(openStatusAt0900);
    renderFor({ ...demoSite, upcomingClosures: CLOSURES });

    expect(screen.getByRole('heading', { level: 3, name: 'Closed on' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Dec 25, 2026 · Christmas',
      'Dec 30, 2026 to Jan 1, 2027 · Year-end inventory',
      'Jan 5, 2027',
    ]);
    await screen.findByText('Open now');
  });

  it('lists two closures with the same dates and note as two rows, with no duplicate key', async () => {
    answerOpenStatus(openStatusAt0900);
    const same = { firstDay: '2026-12-25', lastDay: '2026-12-25', note: 'Christmas' };
    renderFor({ ...demoSite, upcomingClosures: [same, same] });

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Dec 25, 2026 · Christmas',
      'Dec 25, 2026 · Christmas',
    ]);
    await screen.findByText('Open now');
  });

  it('shows no "Closed on" block when no closure is coming', async () => {
    answerOpenStatus(openStatusAt0900);
    renderCard();
    await screen.findByText('Open now');

    expect(screen.queryByText('Closed on')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('wraps a long closure note inside the card and never cuts it off', async () => {
    const note = 'Annual team outing '.repeat(4).trim();
    answerOpenStatus(openStatusAt0900);
    renderFor({ ...demoSite, upcomingClosures: [{ firstDay: '2026-12-25', lastDay: '2026-12-25', note }] });

    const row = screen.getByRole('listitem');
    expect(row).toHaveTextContent(note);
    expect(row.parentElement).toHaveClass('wrap-anywhere');
    await screen.findByText('Open now');
  });

  it('has no axe violations with closures and a closure today', async () => {
    answerOpenStatus(closureToday);
    const { container } = renderFor({ ...demoSite, upcomingClosures: CLOSURES });
    await screen.findByText('Closed now');

    await expectNoAxeViolations(container);
  });
});

describe('HoursCard: empty, partial, loading and error states (UI states)', () => {
  it('a week with no open day is one Closed row and "Closed now" with no Opens part', async () => {
    answerOpenStatus({ ...openStatusAt1800, nextOpening: null });
    const { container } = renderFor({ ...demoSite, hours: closedWeek });

    expect(await screen.findByText('Closed now')).toBeInTheDocument();
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(['Monday to Sunday']);
    expect(screen.getAllByRole('definition').map((definition) => definition.textContent)).toEqual(['Closed']);
    expect(screen.queryByText(/Opens/)).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('groups mixed hours into three rows', async () => {
    answerOpenStatus(openStatusAt0900);
    renderFor({ ...demoSite, hours: mixedWeek });
    await screen.findByText('Open now');

    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Monday to Friday',
      'Saturday',
      'Sunday',
    ]);
    expect(screen.getAllByRole('definition').map((definition) => definition.textContent)).toEqual([
      '9:00 AM - 6:00 PM',
      '9:00 AM - 5:00 PM',
      'Closed',
    ]);
  });

  it('while the status loads shows a pill-sized skeleton and the rows at once', async () => {
    server.use(
      http.get('*/api/v1/public/open-status', async () => {
        await delay('infinite');
      }),
    );
    const { container } = renderCard();

    expect(screen.getAllByRole('term')).toHaveLength(2);
    expect(screen.queryByText('Open now')).not.toBeInTheDocument();
    expect(screen.queryByText('Closed now')).not.toBeInTheDocument();
    expect(container.querySelector(PILL_SKELETON)).not.toBeNull();
    await expectNoAxeViolations(container);
  });

  it('while the shop facts load shows the title, a pill skeleton and three skeleton lines, and no rows', async () => {
    const { container } = renderFor(undefined);

    expect(screen.getByRole('heading', { level: 2, name: 'Business hours' })).toBeInTheDocument();
    expect(screen.queryByRole('term')).not.toBeInTheDocument();
    expect(container.querySelector(PILL_SKELETON)).not.toBeNull();
    expect(container.querySelectorAll('div[aria-hidden="true"] > span[aria-hidden="true"]')).toHaveLength(3);
    await expectNoAxeViolations(container);
  });

  it('when the status read fails leaves out the pill and the line and keeps the rows', async () => {
    server.use(openStatusFailureHandler(404));
    const { container } = renderCard();

    await waitFor(() => {
      expect(container.querySelector(PILL_SKELETON)).toBeNull();
    });
    expect(screen.queryByText('Open now')).not.toBeInTheDocument();
    expect(screen.queryByText('Closed now')).not.toBeInTheDocument();
    expect(screen.getAllByRole('term')).toHaveLength(2);
    await expectNoAxeViolations(container);
  });
});
