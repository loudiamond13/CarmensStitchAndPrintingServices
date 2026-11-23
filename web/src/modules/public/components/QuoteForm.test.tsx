// The Get a Quote form (UI-SPEC Q1 and Q3; INQ-01, INQ-03, D-26, D-38): what a visitor types is sent with the ticket, the success
// state and Send Another, and nothing the visitor typed is cleared by a failure.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ToastProvider } from '@/components/feedback/ToastProvider';
import { expectNoAxeViolations } from '@/test/axe';
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
