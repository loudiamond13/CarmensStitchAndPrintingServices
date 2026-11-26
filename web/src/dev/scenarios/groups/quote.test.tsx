// The QuoteForm scenarios (UI-SPEC "Component Showcase additions"; plan 13-23): the real Get a Quote form in each of its eight states,
// reached with made-up values and a demo service, so no case sends a request. Blush only (the public look) and SPEC-GAP (parity false).
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { createMemoryRouter, MemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { ToastProvider } from '@/components';
import { routes } from '@/core/routes/router';
import { kit } from '@/dev/kit';
import { QuoteFormDemo } from '@/dev/previews/QuoteFormDemo';
import { renderNode } from '@/dev/renderScenario';
import { useProductLinesQuery } from '@/modules/public/hooks/useProductLinesQuery';
import { useSiteQuery } from '@/modules/public/hooks/useSiteQuery';
import { expectNoAxeViolations } from '@/test/axe';
import { collectConsole } from '@/test/consoleGuard';
import { server } from '@/test/msw';
import { scenarios } from './quote';

const IDS = [
  'quote-form-empty',
  'quote-form-field-errors',
  'quote-form-photos-refused',
  'quote-form-sending',
  'quote-form-sent',
  'quote-form-sent-photos-missing',
  'quote-form-rate-limited',
  'quote-form-send-failed',
] as const;

type Id = (typeof IDS)[number];

const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

function renderCase(id: Id, strict = false) {
  const scenario = byId.get(id);
  if (scenario === undefined) {
    throw new Error(`No quote scenario "${id}".`);
  }
  const tree = (
    <MemoryRouter>
      <ToastProvider>
        <div data-case={id}>{renderNode(kit, scenario.node, scenario.handlers ?? [])}</div>
      </ToastProvider>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

function textbox(name: RegExp): HTMLElement {
  return screen.getByRole('textbox', { name });
}

/** Each case loads the form's pieces first, which can pass the 1 s default wait on a busy machine. */
const WAIT = { timeout: 10_000 };

/** What shows once each case has reached its state. */
const READY: Readonly<Record<Id, () => Promise<unknown>>> = {
  'quote-form-empty': () => screen.findByRole('form', { name: 'Inquiry form' }, WAIT),
  'quote-form-field-errors': () => screen.findByText('Enter your name.', {}, WAIT),
  'quote-form-photos-refused': () => screen.findByText(/isn't a photo we can take/, {}, WAIT),
  'quote-form-sending': () =>
    screen.findByText('Sending your photos. This can take a minute on mobile data.', {}, WAIT),
  'quote-form-sent': () => screen.findByRole('heading', { level: 2, name: 'Inquiry sent' }, WAIT),
  'quote-form-sent-photos-missing': () => screen.findByText(/didn't upload/, {}, WAIT),
  'quote-form-rate-limited': () => screen.findByText(/You've sent a few requests/, {}, WAIT),
  'quote-form-send-failed': () => screen.findByText(/Couldn't send your inquiry/, {}, WAIT),
};

/** Lets a request that starts just after a state shows begin, so the "no request" checks would see it. */
async function settle(): Promise<void> {
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
}

// Each case loads the form's pieces and plays a visitor's steps: more than the 5 s default on a busy machine.
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

describe('the quote scenarios', () => {
  it('lists the eight QuoteForm states, Blush only, SPEC-GAP, in the quote group', () => {
    expect(scenarios.map((scenario) => scenario.id)).toEqual(IDS);
    for (const scenario of scenarios) {
      expect(scenario.group, scenario.id).toBe('quote');
      expect(scenario.themes, scenario.id).toEqual(['light']);
      expect(scenario.parity, scenario.id).toBe(false);
      expect(scenario.node.component, scenario.id).toBe('QuoteFormDemo');
    }
  });

  it('shows the empty form', async () => {
    renderCase('quote-form-empty');

    const form = await screen.findByRole('form', { name: 'Inquiry form' }, WAIT);
    expect(textbox(/Your name/)).toHaveValue('');
    expect(within(form).getByRole('button', { name: 'Send Inquiry' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an error on every field a visitor can get wrong', async () => {
    renderCase('quote-form-field-errors');

    expect(await screen.findByText('Enter your name.', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText('Keep the team name to 100 characters or fewer.')).toBeInTheDocument();
    expect(screen.getByText('Enter a mobile number, like 0917 123 4567.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email, like name@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Keep your message to 2,000 characters or fewer.')).toBeInTheDocument();
    for (const name of [/Your name/, /Team/, /Contact number/, /Email/, /Message/]) {
      expect(textbox(name)).toHaveAttribute('aria-invalid', 'true');
    }
  });

  it('shows two photos picked and one file refused', async () => {
    renderCase('quote-form-photos-refused');

    const list = await screen.findByRole('list', { name: 'Photos to send' }, WAIT);
    await waitFor(() => {
      expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    }, WAIT);
    expect(screen.getByRole('alert')).toHaveTextContent("price-list.pdf isn't a photo we can take.");
    expect(screen.getByText('2 of 5 photos')).toBeInTheDocument();
  });

  it('shows the form sending: the pending button, read-only fields and the photo line', async () => {
    renderCase('quote-form-sending');

    expect(
      await screen.findByText('Sending your photos. This can take a minute on mobile data.', {}, WAIT),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sending/ })).toBeInTheDocument();
    expect(textbox(/Your name/)).toHaveAttribute('readonly');
    expect(textbox(/Your name/)).toHaveValue('Juan Dela Cruz');
    expect(textbox(/Contact number/)).toHaveValue('0917 123 4567');
  });

  it('shows the success state', async () => {
    renderCase('quote-form-sent');

    expect(await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' }, WAIT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Another' })).toBeInTheDocument();
    expect(screen.queryByText(/didn't upload/)).not.toBeInTheDocument();
  });

  it('shows the success state with the photos that did not upload and the Messenger link', async () => {
    renderCase('quote-form-sent-photos-missing');

    expect(await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' }, WAIT)).toBeInTheDocument();
    expect(
      screen.getByText(
        "We got your request, but 2 of your photos didn't upload: front-sketch.png, back-sketch.png. Please send them to us on Messenger.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Message Us on Messenger' })).toBeInTheDocument();
  });

  it('shows the rate limit box and keeps what was typed', async () => {
    renderCase('quote-form-rate-limited');

    expect(await screen.findByRole('alert', {}, WAIT)).toHaveTextContent(
      "You've sent a few requests in a short time. Wait a few minutes and try again, or message us on Messenger.",
    );
    expect(textbox(/Your name/)).toHaveValue('Juan Dela Cruz');
    expect(screen.getByRole('link', { name: 'Message Us on Messenger' })).toBeInTheDocument();
  });

  it('shows the send failed box and keeps what was typed', async () => {
    renderCase('quote-form-send-failed');

    expect(await screen.findByRole('alert', {}, WAIT)).toHaveTextContent(
      "Couldn't send your inquiry. Check your internet connection and try again. What you typed is still here.",
    );
    expect(textbox(/Your name/)).toHaveValue('Juan Dela Cruz');
  });

  it.each(IDS)('%s reaches its state under StrictMode, as on the parity page, and sends no request', async (id) => {
    renderCase(id, true);

    await READY[id]();
    await settle();

    expect(requests).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(IDS)('%s has no axe finding and sends no request', async (id) => {
    const { container } = renderCase(id);

    await READY[id]();

    expect(container.textContent).not.toContain('Missing component');
    await expectNoAxeViolations(container);
    await settle();
    expect(requests).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

/** What the app's own shop facts and product lines hold, read outside any demo. */
function SharedStores() {
  const site = useSiteQuery();
  const lines = useProductLinesQuery();
  return <p>{`site ${site.status}, lines ${lines.status}`}</p>;
}

describe('the quote demos keep their made-up data to themselves (CR-01)', () => {
  it('leaves the real Products page its own lines after a quote case shows', async () => {
    const view = renderCase('quote-form-empty');
    await READY['quote-form-empty']();
    view.unmount();

    const router = createMemoryRouter(routes, { initialEntries: ['/products'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('article', { name: 'Volleyball Jerseys' }, { timeout: 15_000 })).toBeInTheDocument();
  });

  it('writes nothing into the shared shop facts and product lines, with the public shell too', async () => {
    const quote = renderCase('quote-form-sent');
    await READY['quote-form-sent']();
    quote.unmount();
    const shell = render(
      <MemoryRouter>{renderNode(kit, { kind: 'node', component: 'PublicShell', props: {} }, [])}</MemoryRouter>,
    );
    shell.unmount();

    render(<SharedStores />);

    expect(screen.getByText('site loading, lines loading')).toBeInTheDocument();
  });

  it('no preview primes a shared public store, not even when it is imported', () => {
    const sources = import.meta.glob<string>('../../previews/*.tsx', { query: '?raw', import: 'default', eager: true });
    const priming = Object.entries(sources)
      .filter(([, source]) => source.includes('.prime('))
      .map(([path]) => path);
    expect(priming).toEqual([]);
  });
});

describe('a quote case whose form piece fails to load (IN-04)', () => {
  // React reports the error its boundary caught.
  afterEach(() => {
    collectConsole();
  });

  it('shows the failed-load message in its own case and leaves the rest of the page', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <p>Rest of the showcase</p>
          <QuoteFormDemo state="empty" load={() => Promise.reject(new Error('chunk 404'))} />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert', {}, WAIT)).toHaveTextContent("Couldn't load the inquiry form.");
    expect(screen.getByText('Rest of the showcase')).toBeInTheDocument();
    expect(screen.queryByRole('form')).toBeNull();
  });
});
