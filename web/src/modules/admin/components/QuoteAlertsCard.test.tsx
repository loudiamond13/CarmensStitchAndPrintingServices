import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/feedback';
import { QuoteAlertsCard } from '@/modules/admin/components/QuoteAlertsCard';
import { acceptSession, clearSession } from '@/modules/admin/services/session';
import { businessInfoSchema, businessInfoValuesOf, type BusinessInfoInput } from '@/modules/admin/siteContentSchemas';
import { expectNoAxeViolations } from '@/test/axe';
import { createDeferred } from '@/test/fakeFetch';
import { server } from '@/test/msw';
import { sessionResponse } from '@/test/sessionFixtures';
import { demoSiteSettings, problemAnswer } from '@/test/siteContentFixtures';

// R5 Quote alerts card (INQ-04, D-07, OR-3; plan 13-07): the card on its own, in a form made from the Business Info schema.

const TEST_ROUTE = '*/api/v1/site-settings/quote-alerts/test';

beforeEach(() => {
  clearSession();
  acceptSession(sessionResponse());
});

afterEach(() => {
  clearSession();
});

/** The card in a form made from the schema; `saved` is the address the server holds (the field's starting value by default). */
function CardInForm({ address, saved = address }: { address: string; saved?: string }) {
  const form = useForm<BusinessInfoInput>({
    resolver: zodResolver(businessInfoSchema),
    mode: 'onBlur',
    defaultValues: { ...businessInfoValuesOf(demoSiteSettings), quoteAlertsEmail: address },
  });
  return (
    <ToastProvider>
      <form noValidate>
        <QuoteAlertsCard control={form.control} savedAddress={saved} />
        <button type="submit">Save</button>
      </form>
    </ToastProvider>
  );
}

/** Answers the test send with `answer` and records each request's Idempotency-Key. */
function testSendBackend(answer: () => Response | Promise<Response> = () => new HttpResponse(null, { status: 202 })) {
  const keys: (string | null)[] = [];
  server.use(
    http.post(TEST_ROUTE, ({ request }) => {
      keys.push(request.headers.get('Idempotency-Key'));
      return answer();
    }),
  );
  return keys;
}

describe('QuoteAlertsCard', () => {
  it('shows the Quote alerts title and hint, and the labelled email field with its hint', () => {
    render(<CardInForm address="" />);

    const card = screen.getByRole('region', { name: 'Quote alerts' });
    expect(within(card).getByRole('heading', { level: 2, name: 'Quote alerts' })).toBeVisible();
    expect(within(card).getByText('Where we email you when a visitor sends a quote request.')).toBeVisible();
    const field = within(card).getByLabelText('Quote alerts email');
    expect(field).toHaveAttribute('type', 'email');
    expect(field).toHaveAttribute('inputmode', 'email');
    expect(field).toHaveAccessibleDescription(
      'Any inbox works, including the shop email. Leave it empty to get no emails; new requests still show in Quote Requests.',
    );
  });

  it('shows the saved address when the form opens (R5 populated) and an empty field when none is saved', () => {
    const { unmount } = render(<CardInForm address="quotes@example.com" />);
    expect(screen.getByLabelText('Quote alerts email')).toHaveValue('quotes@example.com');
    unmount();

    render(<CardInForm address="" />);
    expect(screen.getByLabelText('Quote alerts email')).toHaveValue('');
  });

  it('checks the address when it is left and shows the server wording', async () => {
    const user = userEvent.setup();
    render(<CardInForm address="" />);

    await user.type(screen.getByLabelText('Quote alerts email'), 'nope');
    await user.tab();

    expect(await screen.findByText('Enter a valid email, like name@gmail.com')).toBeVisible();
    expect(screen.getByLabelText('Quote alerts email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('has no axe violations, empty or with an error', async () => {
    const user = userEvent.setup();
    const { container } = render(<CardInForm address="" />);
    await expectNoAxeViolations(container);

    await user.type(screen.getByLabelText('Quote alerts email'), 'nope');
    await user.tab();
    await screen.findByText('Enter a valid email, like name@gmail.com');
    await expectNoAxeViolations(container);
  });

  it('sends a test to the saved address with a request key, shows Sending, then the success toast naming the address (R5)', async () => {
    const gate = createDeferred<undefined>();
    const keys = testSendBackend(async () => {
      await gate.promise;
      return new HttpResponse(null, { status: 202 });
    });
    const user = userEvent.setup();
    render(<CardInForm address="quotes@example.com" />);

    const send = screen.getByRole('button', { name: 'Send Test Email' });
    expect(send).toHaveAttribute('type', 'button');
    expect(send).not.toHaveAttribute('aria-disabled');
    await user.click(send);

    expect(await screen.findByRole('button', { name: 'Sending' })).toHaveAttribute('aria-busy', 'true');
    gate.resolve(undefined);

    expect(await screen.findByText('Test email on its way')).toBeVisible();
    expect(
      screen.getByText('It should reach quotes@example.com within a few minutes. Check the spam folder too.'),
    ).toBeVisible();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(screen.getByRole('button', { name: 'Send Test Email' })).not.toHaveAttribute('aria-disabled');
  });

  it('sends again with a new key when pressed a second time', async () => {
    const keys = testSendBackend();
    const user = userEvent.setup();
    render(<CardInForm address="quotes@example.com" />);

    await user.click(screen.getByRole('button', { name: 'Send Test Email' }));
    await screen.findByText('Test email on its way');
    await user.click(await screen.findByRole('button', { name: 'Send Test Email' }));

    await vi.waitFor(() => {
      expect(keys).toHaveLength(2);
    });
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('waits with its reason while no address is saved, and sends nothing (R5 empty)', async () => {
    const keys = testSendBackend();
    const user = userEvent.setup();
    const { container } = render(<CardInForm address="" />);

    const send = screen.getByRole('button', { name: 'Send Test Email' });
    expect(send).toHaveAttribute('aria-disabled', 'true');
    expect(send).toHaveAccessibleDescription('Save an address first, then send a test.');
    await user.click(send);

    expect(keys).toHaveLength(0);
    await expectNoAxeViolations(container);
  });

  it('waits with its reason while the field differs from the saved address (R5 partial)', async () => {
    const keys = testSendBackend();
    const user = userEvent.setup();
    const { container } = render(<CardInForm address="quotes@example.com" />);

    const field = screen.getByLabelText('Quote alerts email');
    await user.clear(field);
    await user.type(field, 'new.quotes@example.com');

    const send = screen.getByRole('button', { name: 'Send Test Email' });
    expect(send).toHaveAttribute('aria-disabled', 'true');
    expect(send).toHaveAccessibleDescription('Save your change first, then send a test.');
    await user.click(send);
    expect(keys).toHaveLength(0);
    await expectNoAxeViolations(container);

    await user.clear(field);
    await user.type(field, 'quotes@example.com');
    expect(screen.getByRole('button', { name: 'Send Test Email' })).not.toHaveAttribute('aria-disabled');
    expect(screen.queryByText('Save your change first, then send a test.')).not.toBeInTheDocument();
  });

  it('is enabled with no reason when the field holds the saved address (R5 populated)', async () => {
    const { container } = render(<CardInForm address="quotes@example.com" />);

    const send = screen.getByRole('button', { name: 'Send Test Email' });
    expect(send).not.toHaveAttribute('aria-disabled');
    expect(send).not.toHaveAttribute('aria-describedby');
    await expectNoAxeViolations(container);
  });

  it('shows the rate limit toast after a 429 (R5 error)', async () => {
    testSendBackend(() => problemAnswer(429, { code: 'rate-limited' }));
    const user = userEvent.setup();
    const { container } = render(<CardInForm address="quotes@example.com" />);

    await user.click(screen.getByRole('button', { name: 'Send Test Email' }));

    expect(await screen.findByText('Too many test emails.')).toBeVisible();
    expect(screen.getByText('Wait a few minutes and try again.')).toBeVisible();
    expect(screen.queryByText('Test email on its way')).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('shows the send failed toast when the network drops or the server fails (R5 error)', async () => {
    let calls = 0;
    testSendBackend(() => {
      calls += 1;
      return calls === 1 ? HttpResponse.error() : problemAnswer(500);
    });
    const user = userEvent.setup();
    render(<CardInForm address="quotes@example.com" />);

    await user.click(screen.getByRole('button', { name: 'Send Test Email' }));
    expect(await screen.findByText("Couldn't send the test email.")).toBeVisible();
    expect(screen.getByText('Check your internet connection and try again.')).toBeVisible();

    await user.click(await screen.findByRole('button', { name: 'Send Test Email' }));
    await vi.waitFor(() => {
      expect(screen.getAllByText("Couldn't send the test email.")).toHaveLength(2);
    });
  });

  it('wraps a long saved address in the success toast (R5 long-text)', async () => {
    testSendBackend();
    const long = `${'quote.alerts.for.the.shop'.repeat(8)}@example.com`;
    const user = userEvent.setup();
    render(<CardInForm address={long} />);

    await user.click(screen.getByRole('button', { name: 'Send Test Email' }));

    const message = await screen.findByText(`It should reach ${long} within a few minutes. Check the spam folder too.`);
    expect(message.closest('.wrap-anywhere')).not.toBeNull();
  });
});
