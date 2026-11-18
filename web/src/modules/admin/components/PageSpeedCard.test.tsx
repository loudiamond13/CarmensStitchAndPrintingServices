import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageSpeedCard } from '@/modules/admin/components/PageSpeedCard';
import type { PageSpeed } from '@/modules/admin/services/visitorStatsService';
import { expectNoAxeViolations } from '@/test/axe';

// PageSpeedCard (UI-SPEC V1 item 8; ANL-08, D-26): the server's 75th percentile and rating of each Core Web Vital in plain words.
// The browser only formats.

const SPEED: PageSpeed = {
  lcp: { p75: 2400, rating: 'good', samples: 412 },
  cls: { p75: 0.3, rating: 'poor', samples: 380 },
  inp: { p75: 180, rating: 'good', samples: 200 },
  pageViews: 412,
  available: true,
};

/** The row of one measure, found by its name. */
function row(name: string): HTMLElement {
  const item = screen.getByText(name).closest('li');
  if (item === null) throw new Error(`No row ${name}`);
  return item;
}

describe('PageSpeedCard: ratings and values', () => {
  it('shows "Page speed" with its sub line and the three measures in order', () => {
    render(<PageSpeedCard speed={SPEED} />);

    expect(screen.queryByRole('heading', { level: 2, name: 'Page speed' })).not.toBeNull();
    expect(
      screen.getByText("Measured on visitors' own phones and computers. 3 in 4 page views were this good or better."),
    ).toBeInTheDocument();
    const names = within(screen.getByRole('list'))
      .getAllByRole('listitem')
      .map((item) => item.querySelector('[data-speed-name]')?.textContent);
    expect(names).toEqual(['Loading speed', 'Layout shifting', 'Response to taps']);
  });

  it('shows Loading speed as Good with circle-check, its meaning and "2.4 s" read as "2.4 seconds"', () => {
    render(<PageSpeedCard speed={SPEED} />);

    const loading = row('Loading speed');
    const badge = within(loading).getByText('Good');
    expect(badge.querySelector('svg.lucide-circle-check')).not.toBeNull();
    expect(badge.className).toContain('bg-success-soft');
    expect(within(loading).getByText('How fast the main picture or text shows.')).toBeInTheDocument();
    expect(within(loading).getByText('2.4 s')).toHaveAttribute('aria-hidden', 'true');
    expect(within(loading).getByText('2.4 seconds')).toBeInTheDocument();
  });

  it('shows a layout shift score of 0.3 as Poor with circle-x and "0.30" read as "score 0.30"', () => {
    render(<PageSpeedCard speed={SPEED} />);

    const shifting = row('Layout shifting');
    const badge = within(shifting).getByText('Poor');
    expect(badge.querySelector('svg.lucide-circle-x')).not.toBeNull();
    expect(badge.className).toContain('bg-danger-soft');
    expect(within(shifting).getByText('How much the page jumps while it loads.')).toBeInTheDocument();
    expect(within(shifting).getByText('0.30')).toBeInTheDocument();
    expect(within(shifting).getByText('score 0.30')).toBeInTheDocument();
  });

  it('shows Response to taps as "180 ms" read as "180 milliseconds"', () => {
    render(<PageSpeedCard speed={SPEED} />);

    const taps = row('Response to taps');
    expect(within(taps).getByText('How fast the page reacts when you tap or click.')).toBeInTheDocument();
    expect(within(taps).getByText('180 ms')).toBeInTheDocument();
    expect(within(taps).getByText('180 milliseconds')).toBeInTheDocument();
  });

  it('shows Needs work with triangle-alert in the warning tone', () => {
    render(<PageSpeedCard speed={{ ...SPEED, inp: { p75: 320, rating: 'needs-work', samples: 9 } }} />);

    const badge = within(row('Response to taps')).getByText('Needs work');
    expect(badge.querySelector('svg.lucide-triangle-alert')).not.toBeNull();
    expect(badge.className).toContain('bg-warning-soft');
    expect(within(row('Response to taps')).getByText('320 ms')).toBeInTheDocument();
  });

  it('writes a long load in seconds with one decimal and a slow tap with en-PH grouping', () => {
    render(
      <PageSpeedCard
        speed={{
          ...SPEED,
          lcp: { p75: 12345, rating: 'poor', samples: 3 },
          inp: { p75: 1200, rating: 'poor', samples: 3 },
        }}
      />,
    );

    expect(within(row('Loading speed')).getByText('12.4 s')).toBeInTheDocument();
    expect(within(row('Response to taps')).getByText('1,200 ms')).toBeInTheDocument();
  });

  // The server rates the exact value. A value just over a limit must not show as the limit itself, so the shown value rounds up.
  it.each([
    [
      'LCP just over the 2.5 s limit',
      { lcp: { p75: 2530, rating: 'needs-work' as const, samples: 9 } },
      'Loading speed',
      '2.6 s',
    ],
    [
      'LCP exactly on the 2.5 s limit',
      { lcp: { p75: 2500, rating: 'good' as const, samples: 9 } },
      'Loading speed',
      '2.5 s',
    ],
    [
      'CLS just over the 0.1 limit',
      { cls: { p75: 0.104, rating: 'needs-work' as const, samples: 9 } },
      'Layout shifting',
      '0.11',
    ],
    [
      'CLS exactly on the 0.1 limit',
      { cls: { p75: 0.1, rating: 'good' as const, samples: 9 } },
      'Layout shifting',
      '0.10',
    ],
    [
      'INP just over the 200 ms limit',
      { inp: { p75: 200.4, rating: 'needs-work' as const, samples: 9 } },
      'Response to taps',
      '201 ms',
    ],
    [
      'INP exactly on the 200 ms limit',
      { inp: { p75: 200, rating: 'good' as const, samples: 9 } },
      'Response to taps',
      '200 ms',
    ],
  ])('%s never shows a value that contradicts its rating', (_name, change, name, shown) => {
    render(<PageSpeedCard speed={{ ...SPEED, ...change }} />);

    expect(within(row(name)).getByText(shown)).toBeInTheDocument();
  });

  it('says "From 412 page views" under the rows, with en-PH grouping', () => {
    render(<PageSpeedCard speed={{ ...SPEED, pageViews: 1412 }} />);

    expect(screen.getByText('From 1,412 page views')).toBeInTheDocument();
  });

  it('says "From 1 page view" for one', () => {
    render(<PageSpeedCard speed={{ ...SPEED, pageViews: 1 }} />);

    expect(screen.getByText('From 1 page view')).toBeInTheDocument();
  });

  it('shows a measure with no sample as an empty value with no badge, never as zero or Good', () => {
    // Safari sends no layout shift score (12-16), so an iPhone-only range has none.
    render(<PageSpeedCard speed={{ ...SPEED, cls: null }} />);

    const shifting = row('Layout shifting');
    expect(within(shifting).getByText('Not measured')).toBeInTheDocument();
    expect(within(shifting).queryByText('Good')).toBeNull();
    expect(within(shifting).queryByText('0.00')).toBeNull();
    expect(shifting.querySelector('svg.lucide-minus')).not.toBeNull();
    expect(screen.getByText('From 412 page views')).toBeInTheDocument();
  });

  it('shows skeleton lines until the first answer', () => {
    render(<PageSpeedCard speed={undefined} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Page speed' })).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByText(/^From /)).toBeNull();
  });

  it.each(['light', 'dark'])('has no axe violations in the %s theme', async (theme) => {
    const { container } = render(
      <div data-theme={theme}>
        <PageSpeedCard speed={{ ...SPEED, inp: { p75: 320, rating: 'needs-work', samples: 9 } }} />
        <PageSpeedCard speed={{ ...SPEED, cls: null }} />
      </div>,
    );

    await expectNoAxeViolations(container);
  });
});

describe('PageSpeedCard: no samples and old ranges', () => {
  it('says "No speed data for these dates yet." with empty values and no badge when there is no sample', () => {
    render(<PageSpeedCard speed={{ lcp: null, cls: null, inp: null, pageViews: 0, available: true }} />);

    expect(screen.queryByText('No speed data for these dates yet.')).not.toBeNull();
    expect(screen.getAllByText('Not measured')).toHaveLength(3);
    expect(screen.queryByText('Good')).toBeNull();
    expect(screen.queryByText(/^From /)).toBeNull();
  });

  it('says "Not available for dates over 13 months ago" with empty values and no badge for an old range', () => {
    render(<PageSpeedCard speed={{ lcp: null, cls: null, inp: null, pageViews: 0, available: false }} />);

    expect(screen.queryByText('Not available for dates over 13 months ago')).not.toBeNull();
    expect(screen.getAllByText('Not available')).toHaveLength(3);
    expect(screen.queryByText('Good')).toBeNull();
    expect(screen.queryByText('No speed data for these dates yet.')).toBeNull();
    expect(screen.queryByText(/^From /)).toBeNull();
  });

  it.each(['light', 'dark'])(
    'has no axe violations with no samples and an old range in the %s theme',
    async (theme) => {
      const { container } = render(
        <div data-theme={theme}>
          <PageSpeedCard speed={{ lcp: null, cls: null, inp: null, pageViews: 0, available: true }} />
          <PageSpeedCard speed={{ lcp: null, cls: null, inp: null, pageViews: 0, available: false }} />
        </div>,
      );

      await expectNoAxeViolations(container);
    },
  );
});
