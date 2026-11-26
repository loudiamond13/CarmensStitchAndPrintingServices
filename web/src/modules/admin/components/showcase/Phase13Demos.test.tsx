// Phase 13 demos in the Component Showcase (UI-SPEC "Component Showcase additions"; plan 13-23): the status pills, the six status
// badges in Blush and Espresso, the NavCount chip at 0, 1 and 99+ and on the collapsed rail, and the dashboard strip at 0, 3, loading
// and failed, all on made-up values. No test here may cause a request, and no link in a demo may leave the showcase.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ToastProvider } from '@/components';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { Phase13Demos } from './Phase13Demos';

function renderDemos() {
  return render(
    <MemoryRouter initialEntries={['/admin/components']}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/components" element={<Phase13Demos />} />
          <Route path="*" element={<p>Left the showcase</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

function caseFrame(id: string): HTMLElement {
  const frame = document.querySelector(`[data-case="${id}"]`);
  if (!(frame instanceof HTMLElement)) {
    throw new Error(`No [data-case="${id}"] frame.`);
  }
  return frame;
}

/** Every case of the section, in the order the page shows them. */
const CASE_IDS = [
  'quote-status-filter',
  'quote-status-filter-loading',
  'quote-status-badges-blush',
  'quote-status-badges-espresso',
  'nav-count-0',
  'nav-count-1',
  'nav-count-99-plus',
  'nav-count-collapsed',
  'quote-strip-0',
  'quote-strip-3',
  'quote-strip-loading',
  'quote-strip-failed',
];

const STATUS_WORDS = ['New', 'Contacted', 'Quoted', 'Converted', 'Closed', 'Spam'];

// Twelve frames with four sidebars: axe over all of them needs more than the 5 s default on a busy machine.
vi.setConfig({ testTimeout: 30_000 });

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

describe('Phase13Demos: the page', () => {
  it('draws the twelve cases in order, each in its own labelled frame', () => {
    renderDemos();

    const ids = [...document.querySelectorAll('[data-case]')].map((frame) => frame.getAttribute('data-case'));
    expect(ids).toEqual(CASE_IDS);
  });

  it('has no axe finding in any state', async () => {
    const view = renderDemos();

    await expectNoAxeViolations(view.container);
  });

  it('sends no request and stays on the showcase, even when every button and link is pressed', async () => {
    renderDemos();
    const user = userEvent.setup();

    for (const control of [...screen.getAllByRole('button'), ...screen.getAllByRole('link')]) {
      await user.click(control);
    }

    expect(screen.queryByText('Left the showcase')).not.toBeInTheDocument();
    expect(requests).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('Phase13Demos: QuoteStatusFilter', () => {
  it('shows the five pills with the counts and Open selected, and a press selects another pill', async () => {
    renderDemos();
    const frame = within(caseFrame('quote-status-filter'));
    const bar = frame.getByRole('toolbar', { name: 'Show' });

    expect(
      within(bar)
        .getAllByRole('button')
        .map((pill) => pill.textContent),
    ).toEqual(['Open 4 requests', 'Converted 12 requests', 'Closed 3 requests', 'Spam 1 requests', 'All 20 requests']);
    expect(within(bar).getByRole('button', { name: /^Open/ })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(within(bar).getByRole('button', { name: /^All/ }));

    expect(within(bar).getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(bar).getByRole('button', { name: /^Open/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the pills with no counts until the first answer', () => {
    renderDemos();
    const bar = within(caseFrame('quote-status-filter-loading')).getByRole('toolbar', { name: 'Show' });

    expect(
      within(bar)
        .getAllByRole('button')
        .map((pill) => pill.textContent),
    ).toEqual(['Open', 'Converted', 'Closed', 'Spam', 'All']);
  });
});

describe('Phase13Demos: the status badges', () => {
  it.each([
    ['quote-status-badges-blush', 'light'],
    ['quote-status-badges-espresso', 'dark'],
  ])('%s shows the six statuses in the %s theme', (id, theme) => {
    renderDemos();
    const frame = caseFrame(id);

    expect(frame.querySelector(`[data-theme="${theme}"]`)).not.toBeNull();
    for (const word of STATUS_WORDS) {
      expect(within(frame).getByText(word)).toBeInTheDocument();
    }
  });
});

describe('Phase13Demos: the NavCount chip', () => {
  it('at 0 shows the Quote Requests item with no chip and no count in its name', () => {
    renderDemos();
    const frame = within(caseFrame('nav-count-0'));

    expect(frame.getByRole('link', { name: 'Quote Requests' })).toBeInTheDocument();
    expect(frame.queryByText(/ new$/)).not.toBeInTheDocument();
  });

  it('at 1 shows the chip 1 and the name "Quote Requests, 1 new"', () => {
    renderDemos();
    const link = within(caseFrame('nav-count-1')).getByRole('link', { name: 'Quote Requests, 1 new' });

    expect(within(link).getByText('1')).toHaveAttribute('aria-hidden', 'true');
  });

  it('above 99 shows 99+ on the current row', () => {
    renderDemos();
    const link = within(caseFrame('nav-count-99-plus')).getByRole('link', { name: 'Quote Requests, 99+ new' });

    expect(within(link).getByText('99+')).toBeInTheDocument();
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('on the collapsed rail shows a dot, no number, and keeps the count in the name', () => {
    renderDemos();
    const frame = within(caseFrame('nav-count-collapsed'));
    const link = frame.getByRole('link', { name: 'Quote Requests, 3 new' });

    expect(frame.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(within(link).queryByText('3')).not.toBeInTheDocument();
    expect(link.querySelectorAll('span[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});

describe('Phase13Demos: the sidebar pictures (IN-07)', () => {
  it('are inert, so the page keeps one Admin nav and one current page for assistive technology', () => {
    renderDemos();

    for (const id of ['nav-count-0', 'nav-count-1', 'nav-count-99-plus', 'nav-count-collapsed']) {
      const nav = caseFrame(id).querySelector('nav[aria-label="Admin"]');
      expect(nav, id).not.toBeNull();
      expect(nav?.closest('[inert]'), id).not.toBeNull();
    }
  });
});

describe('Phase13Demos: QuoteRequestsStrip', () => {
  function strip(id: string) {
    return within(within(caseFrame(id)).getByRole('region', { name: 'New quote requests' }));
  }

  it('shows 0 and 3 with the link to the inbox', () => {
    renderDemos();

    expect(strip('quote-strip-0').getByText('0')).toBeInTheDocument();
    expect(strip('quote-strip-3').getByText('3')).toBeInTheDocument();
    expect(strip('quote-strip-3').getByRole('link', { name: 'Open Quote Requests' })).toBeInTheDocument();
  });

  it('shows the loading state with no figure and no alert', () => {
    renderDemos();
    const frame = within(caseFrame('quote-strip-loading'));

    expect(frame.queryByRole('alert')).not.toBeInTheDocument();
    expect(frame.queryByText(/^\d+$/)).not.toBeInTheDocument();
    expect(frame.getByRole('link', { name: 'Open Quote Requests' })).toBeInTheDocument();
  });

  it('shows the failed read with its alert and Try Again, and the link still there', () => {
    renderDemos();
    const frame = within(caseFrame('quote-strip-failed'));

    expect(frame.getByRole('alert')).toHaveTextContent("Couldn't load the new requests.");
    expect(frame.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    expect(frame.getByRole('link', { name: 'Open Quote Requests' })).toBeInTheDocument();
  });
});
