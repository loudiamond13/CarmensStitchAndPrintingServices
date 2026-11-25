// The Get a Quote form (UI-SPEC Q1 and Q3; INQ-01, INQ-03, D-26, D-38): what a visitor types is sent with the ticket, the success
// state and Send Another, and nothing the visitor typed is cleared by a failure.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback/ToastProvider';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { HttpError } from '@/core/api/errors';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { demoLines, siteFailureHandler } from '@/test/publicFixtures';
import { answerQuote, QUOTE_ID } from '@/test/quoteFixtures';
import { quoteService } from '../services/quoteService';
import { QuoteForm } from './QuoteForm';

function renderForm(address = '/contact') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[address]}>
      <ToastProvider>{children}</ToastProvider>
    </MemoryRouter>
  );
  return render(<QuoteForm />, { wrapper });
}

/** Shows the address the form sees, so a test can tell it was never rewritten. */
function AddressProbe() {
  const { search } = useLocation();
  return <p>{`Address search: ${search}`}</p>;
}

async function fillRequired(name = 'Juan Dela Cruz', number = '0917 123 4567') {
  await userEvent.type(screen.getByRole('textbox', { name: /Your name/ }), name);
  await userEvent.type(screen.getByRole('textbox', { name: /Contact number/ }), number);
}

const SEND = { name: 'Send Inquiry' } as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('QuoteForm head and fields (Q1)', () => {
  it('is a form named by its title "Inquiry form" with the caption and the two required fields', () => {
    answerQuote();
    renderForm();

    const form = screen.getByRole('form', { name: 'Inquiry form' });
    expect(within(form).getByRole('heading', { level: 2, name: 'Inquiry form' })).toBeInTheDocument();
    expect(within(form).getByText('Fields marked * are required.')).toBeInTheDocument();
    expect(within(form).getByRole('textbox', { name: /Your name/ })).toHaveAttribute('placeholder', 'Juan Dela Cruz');
    expect(within(form).getByRole('textbox', { name: /Contact number/ })).toHaveAttribute(
      'placeholder',
      '0917 123 4567',
    );
    expect(form).toHaveAttribute('novalidate');
  });

  it('shows no error at rest and none before a field is left or the form is sent', async () => {
    answerQuote();
    renderForm();

    await userEvent.click(screen.getByRole('textbox', { name: /Your name/ }));

    expect(screen.queryByText('Enter your name.')).not.toBeInTheDocument();
    expect(document.querySelector('[aria-invalid="true"]')).toBeNull();
  });

  it('has no axe violations at rest', async () => {
    answerQuote();
    const { container } = renderForm();

    await expectNoAxeViolations(container);
  });
});

describe('QuoteForm send (INQ-01)', () => {
  it('sends the name, the number, the ticket and an empty subjectLine, then shows Inquiry sent with focus on its title and the toast', async () => {
    const probe = answerQuote();
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    const title = await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
    expect(title).toHaveFocus();
    expect(screen.getByText("Thanks! We'll message you with a mockup and quote, usually the same day.")).toBeVisible();
    expect(probe.creates).toHaveLength(1);
    expect(probe.creates[0]?.body).toMatchObject({
      customerName: 'Juan Dela Cruz',
      contactNumber: '0917 123 4567',
      ticket: 'ticket-1',
      subjectLine: '',
    });
    expect(probe.creates[0]?.key).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Inquiry form' })).not.toBeInTheDocument();
    const toast = await screen.findByText("We'll message you soon.");
    expect(toast).toBeInTheDocument();
  });

  it('shows the pending label "Sending" while the request runs', async () => {
    answerQuote({ minimumSeconds: 1 });
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    expect(await screen.findByRole('button', { name: 'Sending' })).toBeInTheDocument();
    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
  });

  it('sends nothing and focuses Your name when a required field is empty', async () => {
    const probe = answerQuote();
    renderForm();

    await userEvent.click(screen.getByRole('button', SEND));

    expect(await screen.findByText('Enter your name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a mobile number, like 0917 123 4567.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Your name/ })).toHaveFocus();
    expect(probe.creates).toHaveLength(0);
  });
});

describe('QuoteForm minimum wait (D-41: the server says how long)', () => {
  const RULES = { maxPhotos: 5, maxBytes: 10_485_760, maxPixels: 25_000_000 };

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function expiredAnswer(minimumSeconds: number) {
    return new HttpError({
      kind: 'http',
      status: 400,
      problem: {
        type: undefined,
        title: 'The form timed out. Please send it again.',
        status: 400,
        detail: undefined,
        instance: undefined,
        traceId: undefined,
        code: 'quote-requests.ticket-expired',
        errors: { ticket: ['The form timed out. Please send it again.'] },
        replacementTicket: 'ticket-replacement',
        minimumSeconds,
      },
    });
  }

  /** The service answers at once (no network), so only the form's own wait is on the clock. */
  function stubService(options: { minimumSeconds: number; ticketFails?: boolean; expiredFirst?: boolean }) {
    const getTicket = vi
      .spyOn(quoteService, 'getTicket')
      .mockImplementation(() =>
        options.ticketFails === true
          ? Promise.reject(new HttpError({ kind: 'network' }))
          : Promise.resolve({ ticket: 'ticket-1', photoRules: RULES, minimumSeconds: options.minimumSeconds }),
      );
    const create = vi.spyOn(quoteService, 'create');
    if (options.expiredFirst === true) {
      create.mockRejectedValueOnce(expiredAnswer(options.minimumSeconds));
    }
    create.mockResolvedValue({ id: QUOTE_ID, photoSlots: [] });
    return { getTicket, create };
  }

  /** Fills the form on the real clock, then freezes the clock and sends, so the wait can be stepped. */
  async function sendOnFakeClock() {
    await fillRequired();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    fireEvent.click(screen.getByRole('button', SEND));
  }

  const tickets = (create: ReturnType<typeof stubService>['create']) => create.mock.calls.map(([body]) => body.ticket);

  it('waits the minimum seconds the ticket answer carried, not a fixed 3', async () => {
    const { create } = stubService({ minimumSeconds: 7 });
    renderForm();

    await sendOnFakeClock();
    await vi.advanceTimersByTimeAsync(5000);

    expect(create).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2100);

    expect(tickets(create)).toEqual(['ticket-1']);
  });

  it('waits less than the old fixed 3 seconds when the server says 1', async () => {
    const { create } = stubService({ minimumSeconds: 1 });
    renderForm();

    await sendOnFakeClock();
    await vi.advanceTimersByTimeAsync(1100);

    expect(tickets(create)).toEqual(['ticket-1']);
  });

  it('sends at once when the ticket answer says 0 seconds', async () => {
    const { create } = stubService({ minimumSeconds: 0 });
    renderForm();

    await sendOnFakeClock();
    await vi.advanceTimersByTimeAsync(10);

    expect(tickets(create)).toEqual(['ticket-1']);
  });

  it('waits the first ticket out, then resends at once with the replacement the 400 carried', async () => {
    const { create } = stubService({ minimumSeconds: 7, expiredFirst: true });
    renderForm();

    await sendOnFakeClock();
    await vi.advanceTimersByTimeAsync(5000);
    expect(create).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2100);

    expect(tickets(create)).toEqual(['ticket-1', 'ticket-replacement']);
  });

  it('sends a try without a ticket at once and the resend with the replacement at once, whatever the 400 says', async () => {
    const { create } = stubService({ minimumSeconds: 7, ticketFails: true, expiredFirst: true });
    renderForm();

    await sendOnFakeClock();
    await vi.advanceTimersByTimeAsync(10);

    expect(tickets(create)).toEqual([null, 'ticket-replacement']);
  });
});

describe('QuoteForm Send Another (Q3)', () => {
  it('clears the form, makes a new key and a new ticket, and focuses Your name', async () => {
    const probe = answerQuote();
    renderForm();
    await fillRequired();
    await userEvent.click(screen.getByRole('button', SEND));
    await userEvent.click(await screen.findByRole('button', { name: 'Send Another' }));

    const name = await screen.findByRole('textbox', { name: /Your name/ });
    expect(name).toHaveValue('');
    expect(name).toHaveFocus();
    expect(screen.getByRole('textbox', { name: /Contact number/ })).toHaveValue('');
    await waitFor(() => {
      expect(probe.tickets).toEqual(['ticket-1', 'ticket-2']);
    });

    await fillRequired('Maria Santos', '0918 765 4321');
    await userEvent.click(screen.getByRole('button', SEND));
    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });

    expect(probe.creates).toHaveLength(2);
    expect(probe.creates[1]?.body.ticket).toBe('ticket-2');
    expect(probe.creates[1]?.key).not.toBe(probe.creates[0]?.key);
  });
});

describe('QuoteForm keeps what was typed (D-26)', () => {
  it('keeps every value and shows the send-failed line when the server fails', async () => {
    answerQuote({ createStatuses: [500] });
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      "Couldn't send your inquiry. Check your internet connection and try again. What you typed is still here.",
    );
    expect(screen.getByRole('textbox', { name: /Your name/ })).toHaveValue('Juan Dela Cruz');
    expect(screen.getByRole('textbox', { name: /Contact number/ })).toHaveValue('0917 123 4567');
    expect(screen.queryByRole('heading', { name: 'Inquiry sent' })).not.toBeInTheDocument();
  });

  it('keeps every value when the ticket could not be read, and still sends once the server hands out a ticket', async () => {
    const probe = answerQuote({ ticketStatus: 404, createStatuses: [400, 200], replacementTicket: 'ticket-9' });
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
    expect(probe.creates.map((create) => create.body.ticket)).toEqual([null, 'ticket-9']);
  });
});

describe('QuoteForm expired ticket without a replacement (WR-05)', () => {
  it('reads a new ticket after the failure, so the next send uses it and not the dead one', async () => {
    const probe = answerQuote({ createStatuses: [400, 200], expiredWithoutReplacement: true });
    renderForm();
    await fillRequired();
    await userEvent.click(screen.getByRole('button', SEND));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't send your inquiry.");
    await waitFor(() => {
      expect(probe.tickets).toEqual(['ticket-1', 'ticket-2']);
    });

    await userEvent.click(screen.getByRole('button', SEND));

    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
    expect(probe.creates.map((create) => create.body.ticket)).toEqual(['ticket-1', 'ticket-2']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the values typed while the new ticket is read', async () => {
    answerQuote({ createStatuses: [400], expiredWithoutReplacement: true });
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    await screen.findByRole('alert');
    expect(screen.getByRole('textbox', { name: /Your name/ })).toHaveValue('Juan Dela Cruz');
  });
});

describe('QuoteForm expired ticket (Pitfall 4, D-38)', () => {
  it('resends once, at once, with the replacement ticket and a new Idempotency-Key, and shows only the success', async () => {
    const probe = answerQuote({ createStatuses: [400, 200], replacementTicket: 'ticket-replacement' });
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
    expect(probe.creates).toHaveLength(2);
    expect(probe.creates[0]?.body.ticket).toBe('ticket-1');
    expect(probe.creates[1]?.body.ticket).toBe('ticket-replacement');
    expect(probe.creates[1]?.key).not.toBe(probe.creates[0]?.key);
    expect(probe.tickets).toEqual(['ticket-1']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not resend a second time: a second expired answer shows the send-failed line and keeps the values', async () => {
    const probe = answerQuote({ createStatuses: [400, 400, 400], replacementTicket: 'ticket-replacement' });
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't send your inquiry.");
    expect(probe.creates).toHaveLength(2);
    expect(screen.getByRole('textbox', { name: /Your name/ })).toHaveValue('Juan Dela Cruz');
  });
});

const RATE_LIMITED =
  "You've sent a few requests in a short time. Wait a few minutes and try again, or message us on Messenger.";
const NOT_SURE = "We're not sure your inquiry went through. Press Send Inquiry again. You won't send it twice.";
const SEND_FAILED =
  "Couldn't send your inquiry. Check your internet connection and try again. What you typed is still here.";

describe('QuoteForm rate limited (Q3, D-26, D-37)', () => {
  it('shows the warning box with the Messenger button, keeps every value and leaves focus on Send Inquiry', async () => {
    answerQuote({ createStatuses: [429], problem: { code: 'rate-limited' } });
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(RATE_LIMITED);
    expect(alert).not.toHaveTextContent("Couldn't send");
    expect(within(alert).getByRole('link', { name: 'Message Us on Messenger' })).toHaveAttribute(
      'href',
      'https://m.me/cspsdemo',
    );
    expect(screen.getByRole('textbox', { name: /Your name/ })).toHaveValue('Juan Dela Cruz');
    expect(screen.getByRole('textbox', { name: /Contact number/ })).toHaveValue('0917 123 4567');
    expect(screen.getByRole('button', SEND)).toHaveFocus();
  });

  it('shows the same box for the per-sender limit, which answers 429 too', async () => {
    answerQuote({ createStatuses: [429], problem: { code: 'rate-limited', errors: {} } });
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    expect(await screen.findByRole('alert')).toHaveTextContent(RATE_LIMITED);
  });

  it('leaves the Messenger button out when the shop facts failed to load', async () => {
    server.use(siteFailureHandler());
    answerQuote({ createStatuses: [429] });
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(RATE_LIMITED);
    expect(within(alert).queryByRole('link')).not.toBeInTheDocument();
  });

  it('has no axe violations with the box showing', async () => {
    answerQuote({ createStatuses: [429] });
    const { container } = renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    await screen.findByRole('alert');
    await expectNoAxeViolations(container);
  });
});

describe('QuoteForm when the send may have arrived (Q3 maybe sent)', () => {
  it('says it is not sure after a timeout, and the next press reuses the same Idempotency-Key', async () => {
    const probe = answerQuote();
    const create = vi.spyOn(quoteService, 'create').mockRejectedValueOnce(new HttpError({ kind: 'timeout' }));
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(NOT_SURE);
    expect(alert).not.toHaveTextContent("Couldn't send");
    expect(screen.getByRole('textbox', { name: /Your name/ })).toHaveValue('Juan Dela Cruz');

    await userEvent.click(screen.getByRole('button', SEND));

    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
    expect(create).toHaveBeenCalledTimes(2);
    expect(probe.creates).toHaveLength(1);
    expect(probe.creates[0]?.key).toBe(create.mock.calls[0]?.[1]);
  });

  it('says it is not sure when the connection dropped while online', async () => {
    answerQuote();
    vi.spyOn(quoteService, 'create').mockRejectedValueOnce(new HttpError({ kind: 'network' }));
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    expect(await screen.findByRole('alert')).toHaveTextContent(NOT_SURE);
  });

  it('hides the box while the retry runs and shows a fresh alert when it fails the same way (review G5-WR-02)', async () => {
    answerQuote();
    let fail: (error: unknown) => void = () => undefined;
    vi.spyOn(quoteService, 'create')
      .mockRejectedValueOnce(new HttpError({ kind: 'timeout' }))
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
      );
    renderForm();
    await fillRequired();
    await userEvent.click(screen.getByRole('button', SEND));
    const first = await screen.findByRole('alert');
    expect(first).toHaveTextContent(NOT_SURE);

    await userEvent.click(screen.getByRole('button', SEND));

    await screen.findByRole('button', { name: 'Sending' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fail(new HttpError({ kind: 'timeout' }));
    const second = await screen.findByRole('alert');
    expect(second).toHaveTextContent(NOT_SURE);
    expect(second).not.toBe(first);
  });

  it('says it could not send when the phone is offline', async () => {
    answerQuote();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    vi.spyOn(quoteService, 'create').mockRejectedValueOnce(new HttpError({ kind: 'network' }));
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    expect(await screen.findByRole('alert')).toHaveTextContent(SEND_FAILED);
  });

  it('has no axe violations with the box showing', async () => {
    answerQuote();
    vi.spyOn(quoteService, 'create').mockRejectedValueOnce(new HttpError({ kind: 'timeout' }));
    const { container } = renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    await screen.findByRole('alert');
    await expectNoAxeViolations(container);
  });
});

describe('QuoteForm field errors from the server (Q3)', () => {
  it('puts each message on its own field, in any casing, and focuses the first', async () => {
    answerQuote({
      createStatuses: [400],
      problem: {
        errors: {
          ContactNumber: ['Enter a mobile number we can message.'],
          email: ['Enter an email we can reply to.'],
        },
      },
    });
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    const number = screen.getByRole('textbox', { name: /Contact number/ });
    await waitFor(() => {
      expect(number).toHaveFocus();
    });
    expect(number).toHaveAttribute('aria-invalid', 'true');
    expect(number).toHaveAccessibleDescription(expect.stringContaining('Enter a mobile number we can message.'));
    expect(screen.getByRole('textbox', { name: /Email/ })).toHaveAccessibleDescription(
      expect.stringContaining('Enter an email we can reply to.'),
    );
    expect(number).toHaveValue('0917 123 4567');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('puts a product error on the product field', async () => {
    answerQuote({
      createStatuses: [400],
      problem: { errors: { productLineKey: ['Choose a product from the list.'] } },
    });
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    const product = screen.getByRole('combobox', { name: /Product type/ });
    await waitFor(() => {
      expect(product).toHaveFocus();
    });
    expect(product).toHaveAccessibleDescription(expect.stringContaining('Choose a product from the list.'));
  });

  it('shows the send-failed box when no message matches a field', async () => {
    answerQuote({ createStatuses: [400], problem: { errors: { somethingElse: ['A message for no field.'] } } });
    renderForm();
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    expect(await screen.findByRole('alert')).toHaveTextContent(SEND_FAILED);
  });
});

describe('QuoteForm double press (T-13-37)', () => {
  it('sends once when Send Inquiry is pressed twice', async () => {
    const probe = answerQuote({ minimumSeconds: 1 });
    renderForm();
    await fillRequired();

    await userEvent.dblClick(screen.getByRole('button', SEND));

    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
    expect(probe.creates).toHaveLength(1);
  });
});

const optionNames = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((option) => option.textContent);

describe('QuoteForm fields in the UI-SPEC order (Q1)', () => {
  it('has the seven visible fields in order with their labels, placeholders, hint and autocomplete attributes', () => {
    answerQuote();
    renderForm();
    const form = screen.getByRole('form', { name: 'Inquiry form' });

    const name = within(form).getByRole('textbox', { name: /Your name/ });
    const team = within(form).getByRole('textbox', { name: 'Team / organization' });
    const number = within(form).getByRole('textbox', { name: /Contact number/ });
    const email = within(form).getByRole('textbox', { name: 'Email' });
    const product = within(form).getByRole('combobox', { name: 'Product type' });
    const quantity = within(form).getByRole('combobox', { name: 'Quantity (estimate)' });
    const message = within(form).getByRole('textbox', { name: 'Message' });

    const inOrder = [name, team, number, email, product, quantity, message];
    for (let index = 1; index < inOrder.length; index += 1) {
      expect(inOrder[index - 1]?.compareDocumentPosition(inOrder[index] as Node)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
    expect(name).toHaveAttribute('autocomplete', 'name');
    expect(team).toHaveAttribute('placeholder', 'Brgy. San Roque Ballers');
    expect(team).toHaveAttribute('autocomplete', 'organization');
    expect(number).toHaveAttribute('type', 'tel');
    expect(number).toHaveAttribute('inputmode', 'tel');
    expect(number).toHaveAttribute('autocomplete', 'tel');
    expect(within(form).getByText("We'll text or call about your mockup.")).toBeInTheDocument();
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('inputmode', 'email');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(email).toHaveAttribute('placeholder', 'you@gmail.com');
    expect(message).toHaveAttribute('rows', '6');
    expect(message).toHaveAttribute('placeholder', 'Colors, sport, deadline, sizes, anything you have in mind…');
  });

  it('offers the five quantity ranges after the placeholder', () => {
    answerQuote();
    renderForm();

    expect(optionNames(screen.getByRole('combobox', { name: 'Quantity (estimate)' }))).toEqual([
      'How many pieces?',
      '1-9 pcs',
      '10-20 pcs',
      '21-50 pcs',
      '51-100 pcs',
      '100+ pcs',
    ]);
  });
});

describe('QuoteForm product choices (D-24)', () => {
  it('shows the two fixed choices at once and adds the lines, first and in the Products page order, when they arrive', async () => {
    answerQuote();
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    server.use(
      http.get('*/api/v1/public/product-lines', async () => {
        await gate;
        return HttpResponse.json(demoLines);
      }),
    );
    renderForm();
    const product = screen.getByRole('combobox', { name: 'Product type' });

    expect(optionNames(product)).toEqual(['Choose a product', 'Custom design', 'Not sure yet']);
    open();

    await waitFor(() => {
      expect(optionNames(product)).toEqual([
        'Choose a product',
        'Basketball Jerseys',
        'Volleyball Jerseys',
        'Moto Riding Jerseys',
        'Long Sleeves',
        'Polo Shirts',
        'Custom Designs',
        'Custom design',
        'Not sure yet',
      ]);
    });
  });

  it('keeps the two fixed choices and shows no message when the lines cannot be read', async () => {
    answerQuote();
    let asked = false;
    server.use(
      http.get('*/api/v1/public/product-lines', () => {
        asked = true;
        return HttpResponse.json({ title: 'Not found', status: 404 }, { status: 404 });
      }),
    );
    renderForm();

    await waitFor(() => {
      expect(asked).toBe(true);
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(optionNames(screen.getByRole('combobox', { name: 'Product type' }))).toEqual([
      'Choose a product',
      'Custom design',
      'Not sure yet',
    ]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sends every field, a chosen line as productChoice "line" with its key', async () => {
    const probe = answerQuote();
    renderForm();
    await fillRequired();
    await screen.findByRole('option', { name: 'Basketball Jerseys' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Product type' }), 'Basketball Jerseys');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Quantity (estimate)' }), '10-20 pcs');
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Need 15 jerseys by Dec 12.');
    await userEvent.type(screen.getByRole('textbox', { name: 'Team / organization' }), 'Brgy. San Roque Ballers');
    await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'juan.dc@example.com');

    await userEvent.click(screen.getByRole('button', SEND));
    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });

    expect(probe.creates[0]?.body).toMatchObject({
      customerName: 'Juan Dela Cruz',
      teamName: 'Brgy. San Roque Ballers',
      contactNumber: '0917 123 4567',
      email: 'juan.dc@example.com',
      productChoice: 'line',
      productLineKey: 'basketball',
      quantity: '10-20',
      message: 'Need 15 jerseys by Dec 12.',
      ticket: 'ticket-1',
      subjectLine: '',
    });
  });

  it('sends a fixed choice with no line key, and optional fields left empty as empty', async () => {
    const probe = answerQuote();
    renderForm();
    await fillRequired();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Product type' }), 'Not sure yet');

    await userEvent.click(screen.getByRole('button', SEND));
    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });

    expect(probe.creates[0]?.body).toMatchObject({
      teamName: '',
      email: '',
      productChoice: 'not-sure',
      productLineKey: '',
      quantity: '',
      message: '',
    });
  });
});

describe('QuoteForm validation timing (OR-3, Interaction Contract)', () => {
  it("checks a field when it is left, with the server's words", async () => {
    answerQuote();
    renderForm();
    const email = screen.getByRole('textbox', { name: 'Email' });

    await userEvent.type(email, 'nope');
    expect(screen.queryByText('Enter a valid email, like name@gmail.com')).not.toBeInTheDocument();
    await userEvent.tab();

    expect(await screen.findByText('Enter a valid email, like name@gmail.com')).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
  });

  it('checks every field on send, focuses the first invalid one and sends nothing', async () => {
    const probe = answerQuote();
    renderForm();
    await userEvent.type(screen.getByRole('textbox', { name: /Your name/ }), 'Juan');
    await userEvent.type(screen.getByRole('textbox', { name: /Contact number/ }), '02 8123 4567');
    await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), 'nope');
    await userEvent.click(screen.getByRole('textbox', { name: 'Message' }));
    await userEvent.paste('m'.repeat(2001));

    await userEvent.click(screen.getByRole('button', SEND));

    expect(await screen.findByText('Enter a mobile number, like 0917 123 4567.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email, like name@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Keep your message to 2,000 characters or fewer.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Contact number/ })).toHaveFocus();
    expect(probe.creates).toHaveLength(0);
  });

  it('checks a field with an error again as it is typed, after a send', async () => {
    answerQuote();
    renderForm();
    await userEvent.click(screen.getByRole('button', SEND));
    expect(await screen.findByText('Enter your name.')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: /Your name/ }), 'J');

    await waitFor(() => {
      expect(screen.queryByText('Enter your name.')).not.toBeInTheDocument();
    });
  });
});

describe('QuoteForm honeypot and notice (INQ-03, INQ-08, D-25, D-27)', () => {
  it('has one honeypot input that Tab never reaches, inside a visually hidden aria-hidden wrapper, labelled "Leave this field empty"', () => {
    answerQuote();
    renderForm();

    const honeypot = screen.getByLabelText('Leave this field empty');
    expect(honeypot).toHaveAttribute('name', 'subjectLine');
    expect(honeypot).toHaveAttribute('tabindex', '-1');
    expect(honeypot).toHaveAttribute('autocomplete', 'off');
    const wrapper = honeypot.closest('[aria-hidden="true"]');
    expect(wrapper).not.toBeNull();
    for (const token of srOnlyClasses.split(' ')) {
      expect(wrapper).toHaveClass(token);
    }
    expect(screen.queryByRole('textbox', { name: 'Leave this field empty' })).not.toBeInTheDocument();
  });

  it('still shows the success state when the honeypot is filled, and sends what it holds', async () => {
    const probe = answerQuote();
    renderForm();
    await fillRequired();
    await userEvent.type(screen.getByLabelText('Leave this field empty'), 'bot text');

    await userEvent.click(screen.getByRole('button', SEND));

    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
    expect(probe.creates[0]?.body.subjectLine).toBe('bot text');
  });

  it('shows the privacy notice before Send Inquiry, with Privacy Policy linking to /privacy in the same tab', () => {
    answerQuote();
    renderForm();

    const notice = screen.getByText(/We use your details only to reply to this request and prepare your quote\./);
    expect(notice).toHaveTextContent(
      "We use your details only to reply to this request and prepare your quote. We keep requests that don't become orders for 6 months. See our Privacy Policy.",
    );
    const link = within(notice).getByRole('link', { name: 'Privacy Policy' });
    expect(link).toHaveAttribute('href', '/privacy');
    expect(link).not.toHaveAttribute('target');
    expect(notice.compareDocumentPosition(screen.getByRole('button', SEND))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('has no axe violations with every error showing', async () => {
    answerQuote();
    const { container } = renderForm();
    await userEvent.click(screen.getByRole('button', SEND));
    await screen.findByText('Enter your name.');

    await expectNoAxeViolations(container);
  });
});

describe('QuoteForm product preselect (Q4, D-24)', () => {
  it('chooses no product with no param', async () => {
    answerQuote();
    renderForm();
    await screen.findByRole('option', { name: 'Basketball Jerseys' });

    expect(screen.getByRole('combobox', { name: 'Product type' })).toHaveValue('');
  });

  it('chooses the line named by ?product= once the lines arrive', async () => {
    answerQuote();
    renderForm('/contact?product=volleyball');

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Product type' })).toHaveValue('line:volleyball');
    });
  });

  it.each([
    ['a key that fails the allow-list', '?product=..%2F..%2Fadmin'],
    ['a 200 character key', `?product=${'a'.repeat(200)}`],
    ['a safe key for a hidden line', '?product=hidden-line'],
  ])('ignores %s with no message and leaves the address alone', async (_name, search) => {
    answerQuote();
    render(
      <MemoryRouter initialEntries={[`/contact${search}`]}>
        <ToastProvider>
          <QuoteForm />
          <AddressProbe />
        </ToastProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('option', { name: 'Basketball Jerseys' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.getByRole('combobox', { name: 'Product type' })).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(`Address search: ${search}`)).toBeInTheDocument();
  });

  it('keeps Custom design when the visitor chose it before the lines arrived', async () => {
    answerQuote();
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    server.use(
      http.get('*/api/v1/public/product-lines', async () => {
        await gate;
        return HttpResponse.json(demoLines);
      }),
    );
    renderForm('/contact?product=volleyball');
    const product = screen.getByRole('combobox', { name: 'Product type' });
    await userEvent.selectOptions(product, 'Custom design');

    open();
    await screen.findByRole('option', { name: 'Volleyball Jerseys' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(product).toHaveValue('custom');
  });

  it('does not choose the line again after Send Another', async () => {
    answerQuote();
    renderForm('/contact?product=volleyball');
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Product type' })).toHaveValue('line:volleyball');
    });
    await fillRequired();
    await userEvent.click(screen.getByRole('button', SEND));
    await userEvent.click(await screen.findByRole('button', { name: 'Send Another' }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.getByRole('combobox', { name: 'Product type' })).toHaveValue('');
  });
});
