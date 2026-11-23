// The quote form's place on the Contact page (WR-02): a piece that fails to load is a small message with Try Again, never a blank page.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/axe';
import { collectConsole } from '@/test/consoleGuard';
import { QuoteFormSlot } from './QuoteFormSlot';

function Form() {
  return <form aria-label="Inquiry form" />;
}

// A new promise each call: React marks the promise it reads, so a shared one leaks between tests.
const formModule = (): Promise<{ default: ComponentType }> => Promise.resolve({ default: Form });

describe('QuoteFormSlot', () => {
  // React reports an error its boundary caught; the production root silences it (main.tsx).
  afterEach(() => {
    collectConsole();
  });

  it('shows the form once its piece has loaded', async () => {
    render(<QuoteFormSlot load={formModule} />);

    expect(await screen.findByRole('form', { name: 'Inquiry form' })).toBeInTheDocument();
  });

  it('shows a plain message with Try Again in the form place when the piece fails to load', async () => {
    render(<QuoteFormSlot load={() => Promise.reject(new Error('chunk 404'))} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load the inquiry form.");
    expect(alert).toHaveTextContent('Check your internet connection and try again. You can also message or call us.');
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(alert).not.toHaveTextContent('chunk 404');
  });

  it('has no axe violations in the failed state', async () => {
    const { container } = render(<QuoteFormSlot load={() => Promise.reject(new Error('chunk 404'))} />);
    await screen.findByRole('alert');

    await expectNoAxeViolations(container);
  });

  it('imports the piece again on Try Again and shows the form when it loads this time', async () => {
    const load = vi
      .fn<() => Promise<{ default: ComponentType }>>()
      .mockRejectedValueOnce(new Error('chunk 404'))
      .mockImplementation(formModule);
    render(<QuoteFormSlot load={load} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Try Again' }));

    expect(await screen.findByRole('form', { name: 'Inquiry form' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shows the message again when the second import fails too', async () => {
    const load = vi.fn<() => Promise<{ default: ComponentType }>>().mockRejectedValue(new Error('chunk 404'));
    render(<QuoteFormSlot load={load} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Try Again' }));

    await vi.waitFor(() => {
      expect(load).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the inquiry form.");
  });
});
