// The Get a Quote form (UI-SPEC Q1 and Q3; INQ-01, INQ-03, D-26, D-38): what a visitor types is sent with the ticket, the success
// state and Send Another, and nothing the visitor typed is cleared by a failure.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback/ToastProvider';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { expectNoAxeViolations } from '@/test/axe';
import { server } from '@/test/msw';
import { demoLines } from '@/test/publicFixtures';
import { answerQuote } from '@/test/quoteFixtures';
import { QuoteForm } from './QuoteForm';

function renderForm(props: { minimumWaitMs?: number } = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <ToastProvider>{children}</ToastProvider>
    </MemoryRouter>
  );
  return render(<QuoteForm minimumWaitMs={0} {...props} />, { wrapper });
}

async function fillRequired(name = 'Juan Dela Cruz', number = '0917 123 4567') {
  await userEvent.type(screen.getByRole('textbox', { name: /Your name/ }), name);
  await userEvent.type(screen.getByRole('textbox', { name: /Contact number/ }), number);
}

const SEND = { name: 'Send Inquiry' } as const;

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
    answerQuote();
    renderForm({ minimumWaitMs: 800 });
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));

    expect(await screen.findByRole('button', { name: 'Sending' })).toBeInTheDocument();
    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });
  });

  it('does not send until the minimum time after the ticket has passed (the docs: a client must never cause a too-fast send)', async () => {
    const probe = answerQuote();
    const openedAt = Date.now();
    renderForm({ minimumWaitMs: 600 });
    await fillRequired();

    await userEvent.click(screen.getByRole('button', SEND));
    await screen.findByRole('heading', { level: 2, name: 'Inquiry sent' });

    expect(probe.creates).toHaveLength(1);
    expect(Date.now() - openedAt).toBeGreaterThanOrEqual(550);
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
